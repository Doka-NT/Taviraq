#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);

function readArg(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function tryGit(args) {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function repoUrl() {
  if (process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY) {
    return `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`;
  }

  const remote = tryGit(['config', '--get', 'remote.origin.url']);
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  return match ? `https://github.com/${match[1]}` : '';
}

function tags() {
  const output = tryGit([
    'tag',
    '--list',
    'v[0-9]*.[0-9]*.[0-9]*',
    '--sort=-v:refname',
  ]);

  return output ? output.split('\n').filter(Boolean) : [];
}

function previousTag(tag) {
  return tryGit([
    'describe',
    '--tags',
    '--abbrev=0',
    '--match',
    'v[0-9]*.[0-9]*.[0-9]*',
    `${tag}^`,
  ]);
}

function commitLines(tag) {
  const previous = previousTag(tag);
  const range = previous ? `${previous}..${tag}` : tag;
  const output = tryGit([
    'log',
    range,
    '--pretty=format:%s (%h)',
    '--no-merges',
  ]);

  return output ? output.split('\n').filter(Boolean) : [];
}

function sectionName(subject) {
  if (/^[a-z]+(?:\([^)]+\))?!:/.test(subject) || /BREAKING CHANGE/i.test(subject)) {
    return 'Breaking Changes';
  }

  if (subject.startsWith('feat')) return 'Added';
  if (subject.startsWith('fix')) return 'Fixed';
  if (subject.startsWith('docs')) return 'Documentation';
  if (subject.startsWith('perf')) return 'Performance';
  if (subject.startsWith('test')) return 'Tests';
  if (subject.startsWith('ci')) return 'CI';

  return 'Changed';
}

function renderTag(tag) {
  const groups = new Map();

  for (const line of commitLines(tag)) {
    const name = sectionName(line);
    const values = groups.get(name) ?? [];
    values.push(line);
    groups.set(name, values);
  }

  const date = tryGit(['log', '-1', '--format=%cs', tag]);
  const lines = [`## [${tag.slice(1)}] - ${date || 'unknown'}`, ''];
  const order = [
    'Breaking Changes',
    'Added',
    'Fixed',
    'Changed',
    'Performance',
    'Documentation',
    'Tests',
    'CI',
  ];

  for (const name of order) {
    const values = groups.get(name);
    if (!values?.length) continue;

    lines.push(`### ${name}`, '');
    lines.push(...values.map((value) => `- ${value}`), '');
  }

  if (lines.length === 2) {
    lines.push('- No user-facing changes.', '');
  }

  return lines.join('\n');
}

function renderFullChangelog(allTags, url) {
  const lines = [
    '# Changelog',
    '',
    'Release changelogs are generated from git tags and Conventional Commits.',
    '',
  ];

  for (const tag of allTags) {
    lines.push(renderTag(tag));
  }

  if (url && allTags.length) {
    lines.push(
      ...allTags.map((tag, index) => {
        const previous = allTags[index + 1];
        const version = tag.slice(1);
        const href = previous
          ? `${url}/compare/${previous}...${tag}`
          : `${url}/releases/tag/${tag}`;
        return `[${version}]: ${href}`;
      }),
      '',
    );
  }

  return lines.join('\n');
}

function renderReleaseNotes(tag, url) {
  const previous = previousTag(tag);
  const lines = ['## Changelog', ''];

  if (url && previous) {
    lines.push(`[Full changelog](${url}/compare/${previous}...${tag})`, '');
  }

  lines.push(renderTag(tag), '');
  return lines.join('\n');
}

const changelogPath = readArg('--changelog');
const releaseNotesPath = readArg('--release-notes');
const tag = readArg('--tag');
const allTags = tags();
const url = repoUrl();

if (!allTags.length) {
  throw new Error('No release tags found.');
}

if (changelogPath) {
  writeFileSync(changelogPath, renderFullChangelog(allTags, url));
}

if (releaseNotesPath) {
  if (!tag) throw new Error('--tag is required with --release-notes.');
  writeFileSync(releaseNotesPath, renderReleaseNotes(tag, url));
}
