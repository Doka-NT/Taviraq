export type Language = 'en' | 'ru' | 'cn'

export interface Translations {
  // Settings navigation
  'settings.title': string
  'settings.close': string
  'settings.tab.appearance': string
  'settings.tab.providers': string
  'settings.tab.connections': string
  'settings.tab.prompts': string
  'settings.tab.snippets': string
  'settings.tab.data': string
  'settings.search': string
  'settings.search.empty': string
  'status.saved': string

  // Appearance tab
  'appearance.title': string
  'appearance.fontSize.label': string
  'appearance.fontSize.desc': string
  'appearance.fontSize.applied': string
  'appearance.language.label': string
  'appearance.language.desc': string
  'appearance.language.en': string
  'appearance.language.ru': string
  'appearance.language.cn': string
  'appearance.hideShortcut.label': string
  'appearance.hideShortcut.desc': string
  'appearance.hideShortcut.recording': string
  'appearance.hideShortcut.conflict': string
  'appearance.outputContext.label': string
  'appearance.outputContext.desc': string
  'appearance.theme.label': string
  'appearance.theme.desc': string

  // Providers tab
  'providers.title': string
  'providers.type': string
  'providers.type.openai': string
  'providers.type.ollama': string
  'providers.type.lmstudio': string
  'providers.name': string
  'providers.baseUrl': string
  'providers.apiKey': string
  'providers.allowInsecureTls': string
  'providers.allowInsecureTls.desc': string
  'providers.apiKey.saved': string
  'providers.apiKey.change': string
  'providers.apiKey.placeholder': string
  'providers.apiKey.replacePlaceholder': string
  'providers.save': string
  'providers.fetchModels': string
  'providers.addProvider': string
  'providers.deleteProvider': string
  'providers.deleteConfirmTitle': string
  'providers.deleteConfirmMessage': string
  'providers.deleteConfirmBtn': string
  'providers.active': string
  'providers.unnamed': string
  'providers.chatModel': string
  'providers.safetyModel': string
  'providers.searchChatModel': string
  'providers.searchSafetyModel': string

  // Connections tab
  'connections.title': string
  'connections.addConnection': string
  'connections.deleteConnection': string
  'connections.deleteConfirmTitle': string
  'connections.deleteConfirmMessage': string
  'connections.deleteConfirmBtn': string
  'connections.save': string
  'connections.connect': string
  'connections.name': string
  'connections.host': string
  'connections.user': string
  'connections.port': string
  'connections.identityFile': string
  'connections.browseIdentityFile': string
  'connections.extraArgs': string
  'connections.unnamed': string
  'connections.noConnections': string
  'connections.emptyCta': string
  'connections.newConnection': string
  'connections.tab.newLocal': string

  // Prompts tab
  'prompts.title': string
  'prompts.importFromFile': string
  'prompts.addPrompt': string
  'prompts.savePrompt': string
  'prompts.cancel': string
  'prompts.noPrompts': string
  'prompts.namePlaceholder': string
  'prompts.contentPlaceholder': string
  'prompts.edit': string
  'prompts.delete': string
  'prompts.deleteConfirmTitle': string
  'prompts.deleteConfirmMessage': string
  'prompts.deleteConfirmBtn': string
  'prompts.duplicateName': string

  // Command snippets tab
  'snippets.title': string
  'snippets.quickHint': string
  'snippets.addSnippet': string
  'snippets.saveSnippet': string
  'snippets.noSnippets': string
  'snippets.namePlaceholder': string
  'snippets.commandPlaceholder': string
  'snippets.edit': string
  'snippets.delete': string
  'snippets.deleteConfirmTitle': string
  'snippets.deleteConfirmMessage': string
  'snippets.deleteConfirmBtn': string
  'snippets.duplicateName': string

  // Data tab
  'data.title': string
  'data.exportImport.label': string
  'data.exportImport.desc': string
  'data.export': string
  'data.import': string
  'data.restoreSessions.label': string
  'data.restoreSessions.desc': string
  'data.clearSessions.label': string
  'data.clearSessions.desc': string
  'data.clearSessions': string
  'data.clearSessionsConfirmTitle': string
  'data.clearSessionsConfirmMessage': string
  'data.clearSessionsConfirmBtn': string
  'data.clearChatHistory.label': string
  'data.clearChatHistory.desc': string
  'data.clearChatHistory': string
  'data.clearChatHistory.done': string
  'data.clearChatHistoryConfirmTitle': string
  'data.clearChatHistoryConfirmMessage': string
  'data.clearChatHistoryConfirmBtn': string
  'data.dangerZone': string

  // Terminal
  'terminal.sshDisconnected': string
  'terminal.reconnect': string
  'terminal.searchPlaceholder': string
  'terminal.searchNoResults': string
  'terminal.searchPrevious': string
  'terminal.searchNext': string
  'terminal.searchClose': string
  'terminal.blocks.select': string
  'terminal.blocks.deselect': string
  'terminal.blocks.askAi': string
  'terminal.blocks.copyBlock': string
  'terminal.blocks.copyCommand': string
  'terminal.blocks.copyOutput': string
  'terminal.blocks.rerunCommand': string
  'terminal.blocks.rerunTitle': string
  'terminal.blocks.rerunBody': string
  'terminal.blocks.rerunConfirm': string
  'terminal.blocks.saveSnippet': string
  'terminal.blocks.clearSelection': string
  'terminal.blocks.sendTitle': string
  'terminal.blocks.sendBody': string
  'terminal.blocks.send': string
  'terminal.blocks.selectedCount': string
  'terminal.blocks.askPrompt': string
  'terminal.blocks.label': string
  'terminal.noActiveSession': string

  // Panel header
  'panel.agent': string
  'panel.agentToggle.enable': string
  'panel.agentToggle.disable': string
  'panel.newChat': string
  'panel.settings': string
  'panel.permission.read': string
  'panel.permission.execute': string
  'panel.permission.pending': string
  'panel.status.idle': string
  'panel.status.running': string
  'panel.status.waiting': string
  'sidebar.openHandle': string
  'app.newTerminal': string
  'app.closeSession': string
  'app.settings': string
  'app.showSidebar': string
  'app.hideSidebar': string
  'chat.runInTerminal': string
  'panel.promptLibrary': string

  // Chat area
  'chat.empty.title': string
  'chat.empty.body': string
  'chat.input.placeholder': string
  'chat.send': string
  'chat.stopAgent': string
  'chat.role.user': string
  'chat.role.assistant': string
  'chat.commandOutput.label': string
  'chat.commandOutput.show': string
  'chat.commandOutput.noOutput': string
  'chat.commandEdited.label': string
  'chat.commandEdited.original': string
  'chat.commandEdited.final': string
  'chat.thinking': string
  'chat.regenerate': string
  'chat.forkFromMessage': string
  'chat.forked': string
  'chat.connectProvider': string
  'chat.saveAsPrompt': string
  'chat.savePrompt.generating': string
  'chat.savePrompt.save': string
  'chat.savePrompt.saving': string
  'chat.savePrompt.saved': string
  'chat.savePrompt.error': string
  'chat.history': string
  'chat.historySearch': string
  'chat.historyEmpty': string
  'chat.historyNoMatch': string
  'chat.historyMessages': string
  'chat.historyDelete': string
  'chat.historyDeleteConfirmTitle': string
  'chat.historyDeleteConfirmMessage': string
  'chat.historyDeleteConfirmBtn': string

  // Command confirmation dialog
  'confirm.reviewRisky': string
  'confirm.safetyUnavailable': string
  'confirm.review': string
  'confirm.warning': string
  'confirm.command': string
  'confirm.reason': string
  'confirm.agentPaused': string
  'confirm.cancel': string
  'confirm.runCommand': string
  'confirm.runAnyway': string
  'confirm.shortcutHint': string

  // Status messages (chat inline status)
  'status.checkingSafety': string
  'status.agentStopped.riskyCommand': string
  'status.agentStopped.safetyUnchecked': string
  'status.agentStopped.tenSteps': string
  'status.riskyCommandConfirmed': string
  'status.safetyFailedConfirmed': string
  'status.noSession.agent': string
  'status.noSession.run': string
  'status.disconnected.run': string
  'status.commandAlreadyRunning': string
  'status.modelLoading': string
  'status.promptProcessing': string
  'status.blockPromptQueued': string

  // Suggestion chips
  'chip.space': string
  'chip.spacePrompt': string
  'chip.processes': string
  'chip.processesPrompt': string
  'chip.lastCommand': string
  'chip.lastCommandPrompt': string
  'chip.selection': string
  'chip.selectionPrompt': string
  'chip.git': string
  'chip.gitPrompt': string
  'chip.docker': string
  'chip.dockerPrompt': string
  'chip.logs': string
  'chip.logsPrompt': string
  'chip.disk': string
  'chip.diskPrompt': string

  // Agentic status strip
  'agent.step': string
  'agent.waiting': string
  'agent.running': string

  // Model combobox
  'model.noMatch': string
  'model.loadFirst': string
  'model.loadModelsFirst': string
  'model.showing': string

  // Command snippet palette
  'snippetPalette.title': string
  'snippetPalette.search': string
  'snippetPalette.enterInserts': string
  'snippetPalette.metaEnterRuns': string
  'snippetPalette.addSnippet': string
  'snippetPalette.runNow': string
  'snippetPalette.empty': string
  'snippetPalette.emptyCta': string
  'snippetPalette.noMatch': string

  // Prompt palette
  'promptPalette.title': string
  'promptPalette.search': string
  'promptPalette.enterInserts': string
  'promptPalette.addPrompt': string
  'promptPalette.empty': string
  'promptPalette.emptyCta': string
  'promptPalette.noMatch': string
}

export const en: Translations = {
  'settings.title': 'Settings',
  'settings.close': 'Close settings',
  'settings.tab.appearance': 'Appearance',
  'settings.tab.providers': 'Providers',
  'settings.tab.connections': 'Connections',
  'settings.tab.prompts': 'Prompts',
  'settings.tab.snippets': 'Snippets',
  'settings.tab.data': 'Data',
  'settings.search': 'Search settings',
  'settings.search.empty': 'No sections found',
  'status.saved': 'Saved',

  'appearance.title': 'Appearance',
  'appearance.fontSize.label': 'Terminal font size',
  'appearance.fontSize.desc': 'Applied to all terminal sessions, 8-32 px',
  'appearance.fontSize.applied': '{value}px applied',
  'appearance.language.label': 'Language',
  'appearance.language.desc': 'UI language and LLM response language',
  'appearance.language.en': 'English',
  'appearance.language.ru': 'Русский',
  'appearance.language.cn': '中文',
  'appearance.hideShortcut.label': 'Hide/Show shortcut',
  'appearance.hideShortcut.desc': 'Global shortcut to toggle window visibility',
  'appearance.hideShortcut.recording': 'Press a key combination...',
  'appearance.hideShortcut.conflict': 'Shortcut {shortcut} is used by the system and cannot be assigned',
  'appearance.outputContext.label': 'Output context for AI',
  'appearance.outputContext.desc': 'Recent terminal output sent to the AI. Minimum 1,000 chars',
  'appearance.theme.label': 'Theme',
  'appearance.theme.desc': 'Color scheme for UI and terminal',

  'providers.title': 'Providers',
  'providers.type': 'Provider type',
  'providers.type.openai': 'OpenAI-compatible',
  'providers.type.ollama': 'Ollama',
  'providers.type.lmstudio': 'LM Studio',
  'providers.name': 'Provider name',
  'providers.baseUrl': 'Base URL',
  'providers.apiKey': 'API key',
  'providers.allowInsecureTls': 'Allow insecure TLS',
  'providers.allowInsecureTls.desc': 'Use only for trusted internal endpoints with self-signed certificates.',
  'providers.apiKey.saved': 'saved in keychain',
  'providers.apiKey.change': 'Change',
  'providers.apiKey.placeholder': 'Enter API key…',
  'providers.apiKey.replacePlaceholder': 'Enter new key to replace…',
  'providers.save': 'Save provider',
  'providers.fetchModels': 'Fetch models',
  'providers.addProvider': 'Add provider',
  'providers.deleteProvider': 'Delete provider',
  'providers.deleteConfirmTitle': 'Delete provider?',
  'providers.deleteConfirmMessage': 'This provider configuration and its saved keychain secret will be removed.',
  'providers.deleteConfirmBtn': 'Delete',
  'providers.active': 'active',
  'providers.unnamed': 'Unnamed',
  'providers.chatModel': 'Chat model',
  'providers.safetyModel': 'Command safety model',
  'providers.searchChatModel': 'Search chat model',
  'providers.searchSafetyModel': 'Search safety model',

  'connections.title': 'SSH Connections',
  'connections.addConnection': 'Add connection',
  'connections.deleteConnection': 'Delete connection',
  'connections.deleteConfirmTitle': 'Delete SSH connection?',
  'connections.deleteConfirmMessage': 'This saved SSH connection will be removed.',
  'connections.deleteConfirmBtn': 'Delete',
  'connections.save': 'Save',
  'connections.connect': 'Connect',
  'connections.name': 'Name',
  'connections.host': 'Host',
  'connections.user': 'User',
  'connections.port': 'Port',
  'connections.identityFile': 'Identity file',
  'connections.browseIdentityFile': 'Browse',
  'connections.extraArgs': 'Extra args',
  'connections.unnamed': 'Unnamed',
  'connections.noConnections': 'No SSH connections yet.',
  'connections.emptyCta': 'Add first connection',
  'connections.newConnection': 'New Connection',
  'connections.tab.newLocal': 'New Local Terminal',

  'prompts.title': 'Prompts',
  'prompts.importFromFile': 'Import from file',
  'prompts.addPrompt': 'Add prompt',
  'prompts.savePrompt': 'Save prompt',
  'prompts.cancel': 'Cancel',
  'prompts.noPrompts': 'No prompts yet. Add one below or import a Markdown file.',
  'prompts.namePlaceholder': 'Prompt name',
  'prompts.contentPlaceholder': 'Prompt content…',
  'prompts.edit': 'Edit',
  'prompts.delete': 'Delete',
  'prompts.deleteConfirmTitle': 'Delete prompt?',
  'prompts.deleteConfirmMessage': 'This action cannot be undone.',
  'prompts.deleteConfirmBtn': 'Delete',
  'prompts.duplicateName': 'A prompt with this name already exists.',

  'snippets.title': 'Command Snippets',
  'snippets.quickHint': 'Quick open with ⌘⇧K. Enter inserts, ⌘Enter runs.',
  'snippets.addSnippet': 'Add snippet',
  'snippets.saveSnippet': 'Save snippet',
  'snippets.noSnippets': 'No command snippets yet. Add one below.',
  'snippets.namePlaceholder': 'Snippet name',
  'snippets.commandPlaceholder': 'Terminal command…',
  'snippets.edit': 'Edit',
  'snippets.delete': 'Delete',
  'snippets.deleteConfirmTitle': 'Delete command snippet?',
  'snippets.deleteConfirmMessage': 'This action cannot be undone.',
  'snippets.deleteConfirmBtn': 'Delete',
  'snippets.duplicateName': 'A command snippet with this name already exists.',

  'data.title': 'Data',
  'data.exportImport.label': 'Export / Import',
  'data.exportImport.desc': 'JSON backup with providers, prompts, command snippets and preferences',
  'data.export': 'Export',
  'data.import': 'Import',
  'data.restoreSessions.label': 'Restore tabs and history',
  'data.restoreSessions.desc': 'Reopen tabs with terminal output and assistant history on launch',
  'data.clearSessions.label': 'Saved session state',
  'data.clearSessions.desc': 'Remove stored tabs and scrollback without changing current tabs',
  'data.clearSessions': 'Clear saved state',
  'data.clearSessionsConfirmTitle': 'Clear saved session state?',
  'data.clearSessionsConfirmMessage': 'Stored tabs and scrollback will be removed. Current tabs will stay open.',
  'data.clearSessionsConfirmBtn': 'Clear',
  'data.clearChatHistory.label': 'Chat History',
  'data.clearChatHistory.desc': 'Delete all saved chat conversations',
  'data.clearChatHistory': 'Clear chat history',
  'data.clearChatHistory.done': 'Chat history cleared',
  'data.clearChatHistoryConfirmTitle': 'Clear chat history?',
  'data.clearChatHistoryConfirmMessage': 'All saved chat conversations will be deleted. This action cannot be undone.',
  'data.clearChatHistoryConfirmBtn': 'Clear',
  'data.dangerZone': 'Danger zone',

  'terminal.sshDisconnected': 'SSH session disconnected',
  'terminal.reconnect': 'Reconnect',
  'terminal.searchPlaceholder': 'Search terminal',
  'terminal.searchNoResults': 'No results',
  'terminal.searchPrevious': 'Previous result',
  'terminal.searchNext': 'Next result',
  'terminal.searchClose': 'Close search',
  'terminal.blocks.select': 'Select',
  'terminal.blocks.deselect': 'Deselect',
  'terminal.blocks.askAi': 'Ask AI',
  'terminal.blocks.copyBlock': 'Copy block',
  'terminal.blocks.copyCommand': 'Copy command',
  'terminal.blocks.copyOutput': 'Copy output',
  'terminal.blocks.rerunCommand': 'Rerun command',
  'terminal.blocks.rerunTitle': 'Rerun selected command?',
  'terminal.blocks.rerunBody': 'This command will be sent to the active terminal session.',
  'terminal.blocks.rerunConfirm': 'Rerun',
  'terminal.blocks.saveSnippet': 'Save snippet',
  'terminal.blocks.clearSelection': 'Clear selection',
  'terminal.blocks.sendTitle': 'Send selected blocks to chat?',
  'terminal.blocks.sendBody': 'Commands and the selected terminal output will be sent to the chat. Check that there are no tokens, keys, passwords, private paths, or other sensitive data.',
  'terminal.blocks.send': 'Send',
  'terminal.blocks.selectedCount': '{count} selected block(s)',
  'terminal.blocks.askPrompt': 'Analyze the selected terminal blocks: explain what ran, what the output means, whether there are errors, and what next steps make sense.',
  'terminal.blocks.label': 'Block {index}',
  'terminal.noActiveSession': 'No active terminal session.',

  'panel.agent': 'Agent',
  'panel.agentToggle.enable': 'Enable agent execution',
  'panel.agentToggle.disable': 'Switch to read-only context',
  'panel.newChat': 'New chat',
  'panel.settings': 'Settings',
  'panel.permission.read': 'Read',
  'panel.permission.execute': 'Execute',
  'panel.permission.pending': 'Pending',
  'panel.status.idle': 'Idle',
  'panel.status.running': 'Running',
  'panel.status.waiting': 'Waiting',
  'sidebar.openHandle': 'Open assistant (⌘\\)',
  'app.newTerminal': 'New terminal (⌘T)',
  'app.closeSession': 'Close session (⌘W)',
  'app.settings': 'Settings (⌘,)',
  'app.showSidebar': 'Show assistant sidebar (⌘\\)',
  'app.hideSidebar': 'Hide assistant sidebar (⌘\\)',
  'chat.runInTerminal': 'Run in terminal',
  'panel.promptLibrary': 'Prompt library (⌘⇧P)',

  'chat.empty.title': 'Ready to help',
  'chat.empty.body': 'Ask about your terminal, commands, or selected text',
  'chat.input.placeholder': 'Ask about this terminal…',
  'chat.send': 'Send (Enter)',
  'chat.stopAgent': 'Stop agent',
  'chat.role.user': 'user',
  'chat.role.assistant': 'assistant',
  'chat.commandOutput.label': 'output sent to assistant',
  'chat.commandOutput.show': 'Show output',
  'chat.commandOutput.noOutput': '(no output)',
  'chat.commandEdited.label': 'command edited before run',
  'chat.commandEdited.original': 'Original',
  'chat.commandEdited.final': 'Run',
  'chat.thinking': 'Thinking',
  'chat.regenerate': 'Regenerate',
  'chat.forkFromMessage': 'Fork from here',
  'chat.forked': 'Forked chat from selected message.',
  'chat.connectProvider': 'Connect provider',
  'chat.saveAsPrompt': 'Save as prompt',
  'chat.savePrompt.generating': 'Generating prompt…',
  'chat.savePrompt.save': 'Save',
  'chat.savePrompt.saving': 'Saving…',
  'chat.savePrompt.saved': 'Saved ✓',
  'chat.savePrompt.error': 'Failed to save',
  'chat.history': 'Chat History',
  'chat.historySearch': 'Search chats…',
  'chat.historyEmpty': 'No saved chats yet',
  'chat.historyNoMatch': 'No chats matching "{query}"',
  'chat.historyMessages': 'messages',
  'chat.historyDelete': 'Delete',
  'chat.historyDeleteConfirmTitle': 'Delete chat?',
  'chat.historyDeleteConfirmMessage': 'This saved chat will be deleted. This action cannot be undone.',
  'chat.historyDeleteConfirmBtn': 'Delete',

  'confirm.reviewRisky': 'Review risky command',
  'confirm.safetyUnavailable': 'Safety check unavailable',
  'confirm.review': 'review',
  'confirm.warning': 'warning',
  'confirm.command': 'Command',
  'confirm.reason': 'Reason',
  'confirm.agentPaused': 'Agent is paused until you choose what to do.',
  'confirm.cancel': 'Cancel',
  'confirm.runCommand': 'Run command',
  'confirm.runAnyway': 'Run anyway',
  'confirm.shortcutHint': 'Enter confirms · Esc cancels',

  'status.checkingSafety': 'Checking command safety...',
  'status.agentStopped.riskyCommand': 'Agent stopped before running a risky command.',
  'status.agentStopped.safetyUnchecked': 'Agent stopped because command safety could not be checked.',
  'status.agentStopped.tenSteps': 'Agent stopped after 10 steps.',
  'status.riskyCommandConfirmed': 'Risky command confirmed by user.',
  'status.safetyFailedConfirmed': 'Safety check failed; command confirmed by user.',
  'status.noSession.agent': 'Open a terminal session before starting the agent.',
  'status.noSession.run': 'Open a terminal session before running a command.',
  'status.disconnected.run': 'Reconnect this session before running commands.',
  'status.commandAlreadyRunning': 'A command is already running in this session.',
  'status.modelLoading': 'Loading model {percent}%',
  'status.promptProcessing': 'Processing prompt {percent}%',
  'status.blockPromptQueued': 'Assistant is busy. Block prompt was placed in the input.',

  'chip.space': "What's taking space?",
  'chip.spacePrompt': "What's taking the most disk space here?",
  'chip.processes': 'Check running processes',
  'chip.processesPrompt': 'Check the most important running processes.',
  'chip.lastCommand': 'Explain last command',
  'chip.lastCommandPrompt': 'Explain the last terminal command and its output.',
  'chip.selection': 'Explain selected text',
  'chip.selectionPrompt': 'Explain the selected terminal output.',
  'chip.git': 'Show uncommitted changes',
  'chip.gitPrompt': 'Show me the uncommitted changes in this project.',
  'chip.docker': 'Clean up Docker safely',
  'chip.dockerPrompt': 'Find safe Docker cleanup opportunities.',
  'chip.logs': 'Find largest logs',
  'chip.logsPrompt': 'Find the largest log files and suggest safe cleanup.',
  'chip.disk': 'Summarize disk usage',
  'chip.diskPrompt': 'Summarize what is taking the most disk space.',

  'agent.step': 'Step {step} — {state}',
  'agent.waiting': 'waiting for review',
  'agent.running': 'running',

  'model.noMatch': 'No matching models',
  'model.loadFirst': 'Load models to search',
  'model.loadModelsFirst': 'Load models first',
  'model.showing': 'Showing {visible} of {total}',

  'snippetPalette.title': 'Command snippets',
  'snippetPalette.search': 'Search command snippets...',
  'snippetPalette.enterInserts': 'Enter inserts',
  'snippetPalette.metaEnterRuns': '⌘Enter runs',
  'snippetPalette.addSnippet': 'Add snippet',
  'snippetPalette.runNow': 'Run now',
  'snippetPalette.empty': 'No command snippets yet.',
  'snippetPalette.emptyCta': 'Add snippet',
  'snippetPalette.noMatch': 'No matching snippets.',

  'promptPalette.title': 'Prompts',
  'promptPalette.search': 'Search prompts...',
  'promptPalette.enterInserts': 'Enter inserts',
  'promptPalette.addPrompt': 'Add prompt',
  'promptPalette.empty': 'No prompts yet.',
  'promptPalette.emptyCta': 'Add prompt',
  'promptPalette.noMatch': 'No matching prompts.',
}

export const ru: Translations = {
  'settings.title': 'Настройки',
  'settings.close': 'Закрыть настройки',
  'settings.tab.appearance': 'Внешний вид',
  'settings.tab.providers': 'Провайдеры',
  'settings.tab.connections': 'Подключения',
  'settings.tab.prompts': 'Промпты',
  'settings.tab.snippets': 'Сниппеты',
  'settings.tab.data': 'Данные',
  'settings.search': 'Поиск настроек',
  'settings.search.empty': 'Разделы не найдены',
  'status.saved': 'Сохранено',

  'appearance.title': 'Внешний вид',
  'appearance.fontSize.label': 'Размер шрифта терминала',
  'appearance.fontSize.desc': 'Применяется ко всем сессиям терминала, 8-32 px',
  'appearance.fontSize.applied': 'применено {value}px',
  'appearance.language.label': 'Язык',
  'appearance.language.desc': 'Язык интерфейса и ответов ИИ',
  'appearance.language.en': 'English',
  'appearance.language.ru': 'Русский',
  'appearance.language.cn': '中文',
  'appearance.hideShortcut.label': 'Скрыть/показать окно',
  'appearance.hideShortcut.desc': 'Глобальный шорткат для переключения видимости окна',
  'appearance.hideShortcut.recording': 'Нажмите сочетание клавиш...',
  'appearance.hideShortcut.conflict': 'Шорткат {shortcut} занят системой и не может быть назначен',
  'appearance.outputContext.label': 'Контекст вывода для ИИ',
  'appearance.outputContext.desc': 'Недавний вывод терминала, который увидит ИИ. Минимум 1 000 символов',
  'appearance.theme.label': 'Тема',
  'appearance.theme.desc': 'Цветовая схема интерфейса и терминала',

  'providers.title': 'Провайдеры',
  'providers.type': 'Тип провайдера',
  'providers.type.openai': 'OpenAI-совместимый',
  'providers.type.ollama': 'Ollama',
  'providers.type.lmstudio': 'LM Studio',
  'providers.name': 'Название провайдера',
  'providers.baseUrl': 'Базовый URL',
  'providers.apiKey': 'API-ключ',
  'providers.allowInsecureTls': 'Разрешить небезопасный TLS',
  'providers.allowInsecureTls.desc': 'Используйте только для доверенных внутренних endpoints с самоподписанными сертификатами.',
  'providers.apiKey.saved': 'сохранён в связке ключей',
  'providers.apiKey.change': 'Изменить',
  'providers.apiKey.placeholder': 'Введите API-ключ…',
  'providers.apiKey.replacePlaceholder': 'Введите новый ключ для замены…',
  'providers.save': 'Сохранить провайдера',
  'providers.fetchModels': 'Загрузить модели',
  'providers.addProvider': 'Добавить провайдера',
  'providers.deleteProvider': 'Удалить провайдера',
  'providers.deleteConfirmTitle': 'Удалить провайдера?',
  'providers.deleteConfirmMessage': 'Конфигурация провайдера и сохранённый секрет из keychain будут удалены.',
  'providers.deleteConfirmBtn': 'Удалить',
  'providers.active': 'активный',
  'providers.unnamed': 'Без имени',
  'providers.chatModel': 'Модель чата',
  'providers.safetyModel': 'Модель проверки безопасности',
  'providers.searchChatModel': 'Поиск модели чата',
  'providers.searchSafetyModel': 'Поиск модели безопасности',

  'connections.title': 'SSH-подключения',
  'connections.addConnection': 'Добавить подключение',
  'connections.deleteConnection': 'Удалить подключение',
  'connections.deleteConfirmTitle': 'Удалить SSH-подключение?',
  'connections.deleteConfirmMessage': 'Сохранённое SSH-подключение будет удалено.',
  'connections.deleteConfirmBtn': 'Удалить',
  'connections.save': 'Сохранить',
  'connections.connect': 'Подключиться',
  'connections.name': 'Имя',
  'connections.host': 'Хост',
  'connections.user': 'Пользователь',
  'connections.port': 'Порт',
  'connections.identityFile': 'Файл ключа',
  'connections.browseIdentityFile': 'Выбрать',
  'connections.extraArgs': 'Доп. аргументы',
  'connections.unnamed': 'Без имени',
  'connections.noConnections': 'Нет SSH-подключений.',
  'connections.emptyCta': 'Добавить первое подключение',
  'connections.newConnection': 'Новое подключение',
  'connections.tab.newLocal': 'Новый локальный терминал',

  'prompts.title': 'Промпты',
  'prompts.importFromFile': 'Импорт из файла',
  'prompts.addPrompt': 'Добавить промпт',
  'prompts.savePrompt': 'Сохранить промпт',
  'prompts.cancel': 'Отмена',
  'prompts.noPrompts': 'Нет промптов. Добавьте или импортируйте файл Markdown.',
  'prompts.namePlaceholder': 'Название промпта',
  'prompts.contentPlaceholder': 'Содержание промпта…',
  'prompts.edit': 'Редактировать',
  'prompts.delete': 'Удалить',
  'prompts.deleteConfirmTitle': 'Удалить промпт?',
  'prompts.deleteConfirmMessage': 'Это действие нельзя отменить.',
  'prompts.deleteConfirmBtn': 'Удалить',
  'prompts.duplicateName': 'Промпт с таким именем уже существует.',

  'snippets.title': 'Сниппеты команд',
  'snippets.quickHint': 'Быстрый вызов: ⌘⇧K. Enter вставляет, ⌘Enter запускает.',
  'snippets.addSnippet': 'Добавить сниппет',
  'snippets.saveSnippet': 'Сохранить сниппет',
  'snippets.noSnippets': 'Сниппетов команд пока нет. Добавьте первый ниже.',
  'snippets.namePlaceholder': 'Название сниппета',
  'snippets.commandPlaceholder': 'Команда терминала…',
  'snippets.edit': 'Редактировать',
  'snippets.delete': 'Удалить',
  'snippets.deleteConfirmTitle': 'Удалить сниппет команды?',
  'snippets.deleteConfirmMessage': 'Это действие нельзя отменить.',
  'snippets.deleteConfirmBtn': 'Удалить',
  'snippets.duplicateName': 'Сниппет команды с таким именем уже существует.',

  'data.title': 'Данные',
  'data.exportImport.label': 'Экспорт / Импорт',
  'data.exportImport.desc': 'JSON-бэкап: провайдеры, промпты, сниппеты команд и настройки',
  'data.export': 'Экспорт',
  'data.import': 'Импорт',
  'data.restoreSessions.label': 'Восстанавливать вкладки и историю',
  'data.restoreSessions.desc': 'Открывать вкладки с выводом терминала и историей ассистента при запуске',
  'data.clearSessions.label': 'Сохранённое состояние сессий',
  'data.clearSessions.desc': 'Удалить сохранённые вкладки и вывод, не меняя текущие вкладки',
  'data.clearSessions': 'Очистить состояние',
  'data.clearSessionsConfirmTitle': 'Очистить сохранённое состояние?',
  'data.clearSessionsConfirmMessage': 'Сохранённые вкладки и вывод будут удалены. Текущие вкладки останутся открытыми.',
  'data.clearSessionsConfirmBtn': 'Очистить',
  'data.clearChatHistory.label': 'История чатов',
  'data.clearChatHistory.desc': 'Удалить все сохранённые разговоры',
  'data.clearChatHistory': 'Очистить историю',
  'data.clearChatHistory.done': 'История чатов очищена',
  'data.clearChatHistoryConfirmTitle': 'Очистить историю чатов?',
  'data.clearChatHistoryConfirmMessage': 'Все сохранённые разговоры будут удалены. Это действие нельзя отменить.',
  'data.clearChatHistoryConfirmBtn': 'Очистить',
  'data.dangerZone': 'Зона опасности',

  'terminal.sshDisconnected': 'SSH-сессия отключена',
  'terminal.reconnect': 'Подключиться',
  'terminal.searchPlaceholder': 'Поиск в терминале',
  'terminal.searchNoResults': 'Нет результатов',
  'terminal.searchPrevious': 'Предыдущее совпадение',
  'terminal.searchNext': 'Следующее совпадение',
  'terminal.searchClose': 'Закрыть поиск',
  'terminal.blocks.select': 'Выбрать',
  'terminal.blocks.deselect': 'Снять',
  'terminal.blocks.askAi': 'Спросить ИИ',
  'terminal.blocks.copyBlock': 'Копировать блок',
  'terminal.blocks.copyCommand': 'Копировать команду',
  'terminal.blocks.copyOutput': 'Копировать вывод',
  'terminal.blocks.rerunCommand': 'Запустить снова',
  'terminal.blocks.rerunTitle': 'Запустить выбранную команду снова?',
  'terminal.blocks.rerunBody': 'Команда будет отправлена в активную сессию терминала.',
  'terminal.blocks.rerunConfirm': 'Запустить снова',
  'terminal.blocks.saveSnippet': 'Сохранить сниппет',
  'terminal.blocks.clearSelection': 'Снять выделение',
  'terminal.blocks.sendTitle': 'Отправить выбранные блоки в чат?',
  'terminal.blocks.sendBody': 'В чат попадут команды и весь выбранный вывод терминала. Проверьте, что там нет токенов, ключей, паролей, приватных путей или других чувствительных данных.',
  'terminal.blocks.send': 'Отправить',
  'terminal.blocks.selectedCount': 'Выбрано блоков: {count}',
  'terminal.blocks.askPrompt': 'Разбери выбранные блоки терминала: объясни, что выполнялось, что означает вывод, есть ли ошибки и какие следующие шаги разумны.',
  'terminal.blocks.label': 'Блок {index}',
  'terminal.noActiveSession': 'Нет активной сессии терминала.',

  'panel.agent': 'Агент',
  'panel.agentToggle.enable': 'Включить режим агента',
  'panel.agentToggle.disable': 'Перейти в режим только чтения',
  'panel.newChat': 'Новый чат',
  'panel.settings': 'Настройки',
  'panel.permission.read': 'Чтение',
  'panel.permission.execute': 'Выполнение',
  'panel.permission.pending': 'Ожидание',
  'panel.status.idle': 'Ожидание',
  'panel.status.running': 'Работает',
  'panel.status.waiting': 'Ждёт подтв.',
  'sidebar.openHandle': 'Открыть ассистента (⌘\\)',
  'app.newTerminal': 'Новый терминал (⌘T)',
  'app.closeSession': 'Закрыть сессию (⌘W)',
  'app.settings': 'Настройки (⌘,)',
  'app.showSidebar': 'Показать ассистента (⌘\\)',
  'app.hideSidebar': 'Скрыть ассистента (⌘\\)',
  'chat.runInTerminal': 'Запустить в терминале',
  'panel.promptLibrary': 'Библиотека промптов (⌘⇧P)',

  'chat.empty.title': 'Готов помочь',
  'chat.empty.body': 'Спросите о терминале, командах или выделенном тексте',
  'chat.input.placeholder': 'Спросите о терминале…',
  'chat.send': 'Отправить (Enter)',
  'chat.stopAgent': 'Остановить агента',
  'chat.role.user': 'пользователь',
  'chat.role.assistant': 'ассистент',
  'chat.commandOutput.label': 'вывод отправлен ассистенту',
  'chat.commandOutput.show': 'Показать вывод',
  'chat.commandOutput.noOutput': '(нет вывода)',
  'chat.commandEdited.label': 'команда изменена перед запуском',
  'chat.commandEdited.original': 'Было',
  'chat.commandEdited.final': 'Запуск',
  'chat.thinking': 'Думаю',
  'chat.regenerate': 'Сгенерировать заново',
  'chat.forkFromMessage': 'Форкнуть отсюда',
  'chat.forked': 'Чат форкнут от выбранного сообщения.',
  'chat.connectProvider': 'Подключить провайдера',
  'chat.saveAsPrompt': 'Сохранить как промпт',
  'chat.savePrompt.generating': 'Генерирую промпт…',
  'chat.savePrompt.save': 'Сохранить',
  'chat.savePrompt.saving': 'Сохраняю…',
  'chat.savePrompt.saved': 'Сохранено ✓',
  'chat.savePrompt.error': 'Ошибка сохранения',
  'chat.history': 'История чатов',
  'chat.historySearch': 'Поиск чатов…',
  'chat.historyEmpty': 'Нет сохранённых чатов',
  'chat.historyNoMatch': 'Нет чатов по запросу «{query}»',
  'chat.historyMessages': 'сообщений',
  'chat.historyDelete': 'Удалить',
  'chat.historyDeleteConfirmTitle': 'Удалить чат?',
  'chat.historyDeleteConfirmMessage': 'Сохранённый чат будет удалён. Это действие нельзя отменить.',
  'chat.historyDeleteConfirmBtn': 'Удалить',

  'confirm.reviewRisky': 'Проверьте опасную команду',
  'confirm.safetyUnavailable': 'Проверка безопасности недоступна',
  'confirm.review': 'проверка',
  'confirm.warning': 'предупреждение',
  'confirm.command': 'Команда',
  'confirm.reason': 'Причина',
  'confirm.agentPaused': 'Агент приостановлен до вашего выбора.',
  'confirm.cancel': 'Отмена',
  'confirm.runCommand': 'Выполнить команду',
  'confirm.runAnyway': 'Всё равно выполнить',
  'confirm.shortcutHint': 'Enter подтверждает · Esc отменяет',

  'status.checkingSafety': 'Проверка безопасности команды...',
  'status.agentStopped.riskyCommand': 'Агент остановлен перед выполнением опасной команды.',
  'status.agentStopped.safetyUnchecked': 'Агент остановлен: не удалось проверить безопасность команды.',
  'status.agentStopped.tenSteps': 'Агент остановлен после 10 шагов.',
  'status.riskyCommandConfirmed': 'Опасная команда подтверждена пользователем.',
  'status.safetyFailedConfirmed': 'Проверка безопасности не выполнена; команда подтверждена.',
  'status.noSession.agent': 'Откройте сессию терминала перед запуском агента.',
  'status.noSession.run': 'Откройте сессию терминала перед выполнением команды.',
  'status.disconnected.run': 'Переподключите эту сессию перед выполнением команд.',
  'status.commandAlreadyRunning': 'В этой сессии уже выполняется команда.',
  'status.modelLoading': 'Загрузка модели {percent}%',
  'status.promptProcessing': 'Обработка промпта {percent}%',
  'status.blockPromptQueued': 'Ассистент занят. Промпт по блоку помещён в поле ввода.',

  'chip.space': 'Что занимает место?',
  'chip.spacePrompt': 'Что занимает больше всего места на диске?',
  'chip.processes': 'Проверить процессы',
  'chip.processesPrompt': 'Проверь самые важные запущенные процессы.',
  'chip.lastCommand': 'Объяснить последнюю команду',
  'chip.lastCommandPrompt': 'Объясни последнюю команду терминала и её вывод.',
  'chip.selection': 'Объяснить выделенное',
  'chip.selectionPrompt': 'Объясни выделенный текст терминала.',
  'chip.git': 'Незакоммиченные изменения',
  'chip.gitPrompt': 'Покажи незакоммиченные изменения в этом проекте.',
  'chip.docker': 'Очистить Docker',
  'chip.dockerPrompt': 'Найди безопасные способы очистки Docker.',
  'chip.logs': 'Найти большие логи',
  'chip.logsPrompt': 'Найди самые большие файлы логов и предложи безопасную очистку.',
  'chip.disk': 'Анализ использования диска',
  'chip.diskPrompt': 'Покажи, что занимает больше всего места на диске.',

  'agent.step': 'Шаг {step} — {state}',
  'agent.waiting': 'ожидание проверки',
  'agent.running': 'выполнение',

  'model.noMatch': 'Нет подходящих моделей',
  'model.loadFirst': 'Загрузите модели для поиска',
  'model.loadModelsFirst': 'Сначала загрузите модели',
  'model.showing': 'Показано {visible} из {total}',

  'snippetPalette.title': 'Сниппеты команд',
  'snippetPalette.search': 'Поиск сниппетов команд...',
  'snippetPalette.enterInserts': 'Enter вставляет',
  'snippetPalette.metaEnterRuns': '⌘Enter запускает',
  'snippetPalette.addSnippet': 'Добавить сниппет',
  'snippetPalette.runNow': 'Запустить сейчас',
  'snippetPalette.empty': 'Сниппетов команд пока нет.',
  'snippetPalette.emptyCta': 'Добавить сниппет',
  'snippetPalette.noMatch': 'Подходящих сниппетов нет.',

  'promptPalette.title': 'Промпты',
  'promptPalette.search': 'Поиск промптов...',
  'promptPalette.enterInserts': 'Enter вставляет',
  'promptPalette.addPrompt': 'Добавить промпт',
  'promptPalette.empty': 'Промптов пока нет.',
  'promptPalette.emptyCta': 'Добавить промпт',
  'promptPalette.noMatch': 'Подходящих промптов нет.',
}

export const cn: Translations = {
  'settings.title': '设置',
  'settings.close': '关闭设置',
  'settings.tab.appearance': '外观',
  'settings.tab.providers': '提供商',
  'settings.tab.connections': '连接',
  'settings.tab.prompts': '提示词',
  'settings.tab.snippets': '片段',
  'settings.tab.data': '数据',
  'settings.search': '搜索设置',
  'settings.search.empty': '未找到部分',
  'status.saved': '已保存',

  'appearance.title': '外观',
  'appearance.fontSize.label': '终端字体大小',
  'appearance.fontSize.desc': '应用于所有终端会话，8-32 px',
  'appearance.fontSize.applied': '已应用 {value}px',
  'appearance.language.label': '语言',
  'appearance.language.desc': '界面语言和AI回复语言',
  'appearance.language.en': 'English',
  'appearance.language.ru': 'Русский',
  'appearance.language.cn': '中文',
  'appearance.hideShortcut.label': '隐藏/显示快捷键',
  'appearance.hideShortcut.desc': '用于切换窗口可见性的全局快捷键',
  'appearance.hideShortcut.recording': '按下快捷键组合...',
  'appearance.hideShortcut.conflict': '快捷键 {shortcut} 已被系统占用，无法分配',
  'appearance.outputContext.label': 'AI输出上下文',
  'appearance.outputContext.desc': '发送给 AI 的最近终端输出。最少 1,000 个字符',
  'appearance.theme.label': '主题',
  'appearance.theme.desc': '界面和终端配色方案',

  'providers.title': '提供商',
  'providers.type': '提供商类型',
  'providers.type.openai': 'OpenAI兼容',
  'providers.type.ollama': 'Ollama',
  'providers.type.lmstudio': 'LM Studio',
  'providers.name': '提供商名称',
  'providers.baseUrl': '基础URL',
  'providers.apiKey': 'API密钥',
  'providers.allowInsecureTls': '允许不安全TLS',
  'providers.allowInsecureTls.desc': '仅用于带有自签名证书的可信内部端点。',
  'providers.apiKey.saved': '已保存到密钥链',
  'providers.apiKey.change': '更改',
  'providers.apiKey.placeholder': '输入API密钥…',
  'providers.apiKey.replacePlaceholder': '输入新密钥以替换…',
  'providers.save': '保存提供商',
  'providers.fetchModels': '获取模型',
  'providers.addProvider': '添加提供商',
  'providers.deleteProvider': '删除提供商',
  'providers.deleteConfirmTitle': '删除提供商？',
  'providers.deleteConfirmMessage': '此提供商配置及其保存的钥匙串密钥将被删除。',
  'providers.deleteConfirmBtn': '删除',
  'providers.active': '活跃',
  'providers.unnamed': '未命名',
  'providers.chatModel': '聊天模型',
  'providers.safetyModel': '命令安全模型',
  'providers.searchChatModel': '搜索聊天模型',
  'providers.searchSafetyModel': '搜索安全模型',

  'connections.title': 'SSH 连接',
  'connections.addConnection': '添加连接',
  'connections.deleteConnection': '删除连接',
  'connections.deleteConfirmTitle': '删除 SSH 连接？',
  'connections.deleteConfirmMessage': '此保存的 SSH 连接将被删除。',
  'connections.deleteConfirmBtn': '删除',
  'connections.save': '保存',
  'connections.connect': '连接',
  'connections.name': '名称',
  'connections.host': '主机',
  'connections.user': '用户',
  'connections.port': '端口',
  'connections.identityFile': '密钥文件',
  'connections.browseIdentityFile': '浏览',
  'connections.extraArgs': '额外参数',
  'connections.unnamed': '未命名',
  'connections.noConnections': '暂无 SSH 连接。',
  'connections.emptyCta': '添加第一个连接',
  'connections.newConnection': '新连接',
  'connections.tab.newLocal': '新建本地终端',

  'prompts.title': '提示词',
  'prompts.importFromFile': '从文件导入',
  'prompts.addPrompt': '添加提示词',
  'prompts.savePrompt': '保存提示词',
  'prompts.cancel': '取消',
  'prompts.noPrompts': '还没有提示词。请在下方添加或导入Markdown文件。',
  'prompts.namePlaceholder': '提示词名称',
  'prompts.contentPlaceholder': '提示词内容…',
  'prompts.edit': '编辑',
  'prompts.delete': '删除',
  'prompts.deleteConfirmTitle': '删除提示词？',
  'prompts.deleteConfirmMessage': '此操作无法撤销。',
  'prompts.deleteConfirmBtn': '删除',
  'prompts.duplicateName': '已存在同名提示词。',

  'snippets.title': '命令片段',
  'snippets.quickHint': '使用 ⌘⇧K 快速打开。Enter 插入，⌘Enter 运行。',
  'snippets.addSnippet': '添加片段',
  'snippets.saveSnippet': '保存片段',
  'snippets.noSnippets': '还没有命令片段。请在下方添加。',
  'snippets.namePlaceholder': '片段名称',
  'snippets.commandPlaceholder': '终端命令…',
  'snippets.edit': '编辑',
  'snippets.delete': '删除',
  'snippets.deleteConfirmTitle': '删除命令片段？',
  'snippets.deleteConfirmMessage': '此操作无法撤销。',
  'snippets.deleteConfirmBtn': '删除',
  'snippets.duplicateName': '已存在同名命令片段。',

  'data.title': '数据',
  'data.exportImport.label': '导出 / 导入',
  'data.exportImport.desc': 'JSON 备份，包含提供商、提示词、命令片段和偏好设置',
  'data.export': '导出',
  'data.import': '导入',
  'data.restoreSessions.label': '恢复标签页和历史',
  'data.restoreSessions.desc': '启动时重新打开标签页、终端输出和助手历史',
  'data.clearSessions.label': '已保存的会话状态',
  'data.clearSessions.desc': '删除已保存的标签页和回滚内容，不改变当前标签页',
  'data.clearSessions': '清除保存状态',
  'data.clearSessionsConfirmTitle': '清除保存的会话状态？',
  'data.clearSessionsConfirmMessage': '已保存的标签页和回滚内容将被删除，当前标签页会保持打开。',
  'data.clearSessionsConfirmBtn': '清除',
  'data.clearChatHistory.label': '聊天记录',
  'data.clearChatHistory.desc': '删除所有保存的聊天对话',
  'data.clearChatHistory': '清除聊天记录',
  'data.clearChatHistory.done': '聊天记录已清除',
  'data.clearChatHistoryConfirmTitle': '清除聊天记录？',
  'data.clearChatHistoryConfirmMessage': '所有保存的聊天对话都将被删除。此操作无法撤销。',
  'data.clearChatHistoryConfirmBtn': '清除',
  'data.dangerZone': '危险区域',

  'terminal.sshDisconnected': 'SSH 会话已断开',
  'terminal.reconnect': '重新连接',
  'terminal.searchPlaceholder': '搜索终端',
  'terminal.searchNoResults': '无结果',
  'terminal.searchPrevious': '上一个结果',
  'terminal.searchNext': '下一个结果',
  'terminal.searchClose': '关闭搜索',
  'terminal.blocks.select': '选择',
  'terminal.blocks.deselect': '取消选择',
  'terminal.blocks.askAi': '询问 AI',
  'terminal.blocks.copyBlock': '复制块',
  'terminal.blocks.copyCommand': '复制命令',
  'terminal.blocks.copyOutput': '复制输出',
  'terminal.blocks.rerunCommand': '重新运行命令',
  'terminal.blocks.rerunTitle': '重新运行所选命令？',
  'terminal.blocks.rerunBody': '此命令将发送到活动终端会话。',
  'terminal.blocks.rerunConfirm': '重新运行',
  'terminal.blocks.saveSnippet': '保存片段',
  'terminal.blocks.clearSelection': '清除选择',
  'terminal.blocks.sendTitle': '将所选块发送到聊天？',
  'terminal.blocks.sendBody': '命令和所选终端输出将发送到聊天。请确认其中没有令牌、密钥、密码、私有路径或其他敏感数据。',
  'terminal.blocks.send': '发送',
  'terminal.blocks.selectedCount': '已选择 {count} 个块',
  'terminal.blocks.askPrompt': '分析所选终端块：解释执行了什么、输出含义、是否有错误，以及合理的下一步。',
  'terminal.blocks.label': '块 {index}',
  'terminal.noActiveSession': '没有活动的终端会话。',

  'panel.agent': '代理',
  'panel.agentToggle.enable': '启用代理执行',
  'panel.agentToggle.disable': '切换到只读上下文',
  'panel.newChat': '新建聊天',
  'panel.settings': '设置',
  'panel.permission.read': '读取',
  'panel.permission.execute': '执行',
  'panel.permission.pending': '待处理',
  'panel.status.idle': '空闲',
  'panel.status.running': '运行中',
  'panel.status.waiting': '等待确认',
  'sidebar.openHandle': '打开助手 (⌘\\)',
  'app.newTerminal': '新建终端 (⌘T)',
  'app.closeSession': '关闭会话 (⌘W)',
  'app.settings': '设置 (⌘,)',
  'app.showSidebar': '显示助手面板 (⌘\\)',
  'app.hideSidebar': '隐藏助手面板 (⌘\\)',
  'chat.runInTerminal': '在终端中运行',
  'panel.promptLibrary': '提示词库 (⌘⇧P)',

  'chat.empty.title': '准备就绪',
  'chat.empty.body': '询问关于终端、命令或选定文本的问题',
  'chat.input.placeholder': '询问关于此终端的问题…',
  'chat.send': '发送（Enter）',
  'chat.stopAgent': '停止代理',
  'chat.role.user': '用户',
  'chat.role.assistant': '助手',
  'chat.commandOutput.label': '输出已发送给助手',
  'chat.commandOutput.show': '显示输出',
  'chat.commandOutput.noOutput': '（无输出）',
  'chat.commandEdited.label': '命令在运行前已编辑',
  'chat.commandEdited.original': '原命令',
  'chat.commandEdited.final': '运行',
  'chat.thinking': '思考中',
  'chat.regenerate': '重新生成',
  'chat.forkFromMessage': '从此处分叉',
  'chat.forked': '已从所选消息分叉聊天。',
  'chat.connectProvider': '连接提供商',
  'chat.saveAsPrompt': '保存为提示词',
  'chat.savePrompt.generating': '生成提示词中…',
  'chat.savePrompt.save': '保存',
  'chat.savePrompt.saving': '保存中…',
  'chat.savePrompt.saved': '已保存 ✓',
  'chat.savePrompt.error': '保存失败',
  'chat.history': '聊天记录',
  'chat.historySearch': '搜索聊天…',
  'chat.historyEmpty': '暂无保存的聊天',
  'chat.historyNoMatch': '没有匹配“{query}”的聊天',
  'chat.historyMessages': '条消息',
  'chat.historyDelete': '删除',
  'chat.historyDeleteConfirmTitle': '删除聊天？',
  'chat.historyDeleteConfirmMessage': '此保存的聊天将被删除。此操作无法撤销。',
  'chat.historyDeleteConfirmBtn': '删除',

  'confirm.reviewRisky': '审查危险命令',
  'confirm.safetyUnavailable': '安全检查不可用',
  'confirm.review': '审查',
  'confirm.warning': '警告',
  'confirm.command': '命令',
  'confirm.reason': '原因',
  'confirm.agentPaused': '代理已暂停，等待您的选择。',
  'confirm.cancel': '取消',
  'confirm.runCommand': '执行命令',
  'confirm.runAnyway': '仍然执行',
  'confirm.shortcutHint': 'Enter 确认 · Esc 取消',

  'status.checkingSafety': '正在检查命令安全性...',
  'status.agentStopped.riskyCommand': '代理在执行危险命令前已停止。',
  'status.agentStopped.safetyUnchecked': '由于无法检查命令安全性，代理已停止。',
  'status.agentStopped.tenSteps': '代理在10步后停止。',
  'status.riskyCommandConfirmed': '用户已确认危险命令。',
  'status.safetyFailedConfirmed': '安全检查失败；命令已由用户确认。',
  'status.noSession.agent': '在启动代理之前，请打开终端会话。',
  'status.noSession.run': '在运行命令之前，请打开终端会话。',
  'status.disconnected.run': '运行命令前请重新连接此会话。',
  'status.commandAlreadyRunning': '此会话中已有命令正在运行。',
  'status.modelLoading': '正在加载模型 {percent}%',
  'status.promptProcessing': '正在处理提示 {percent}%',
  'status.blockPromptQueued': '助手正忙。块提示已放入输入框。',

  'chip.space': '什么占用了空间？',
  'chip.spacePrompt': '这里什么占用了最多磁盘空间？',
  'chip.processes': '检查运行中的进程',
  'chip.processesPrompt': '检查最重要的运行中进程。',
  'chip.lastCommand': '解释上一个命令',
  'chip.lastCommandPrompt': '解释上一个终端命令及其输出。',
  'chip.selection': '解释选定文本',
  'chip.selectionPrompt': '解释选定的终端输出。',
  'chip.git': '显示未提交的更改',
  'chip.gitPrompt': '显示此项目中未提交的更改。',
  'chip.docker': '安全清理Docker',
  'chip.dockerPrompt': '查找安全的Docker清理机会。',
  'chip.logs': '查找最大的日志',
  'chip.logsPrompt': '查找最大的日志文件并建议安全清理。',
  'chip.disk': '汇总磁盘使用情况',
  'chip.diskPrompt': '汇总占用最多磁盘空间的内容。',

  'agent.step': '第 {step} 步 — {state}',
  'agent.waiting': '等待审查',
  'agent.running': '运行中',

  'model.noMatch': '没有匹配的模型',
  'model.loadFirst': '加载模型以搜索',
  'model.loadModelsFirst': '请先加载模型',
  'model.showing': '显示 {visible} / {total}',

  'snippetPalette.title': '命令片段',
  'snippetPalette.search': '搜索命令片段...',
  'snippetPalette.enterInserts': 'Enter 插入',
  'snippetPalette.metaEnterRuns': '⌘Enter 运行',
  'snippetPalette.addSnippet': '添加片段',
  'snippetPalette.runNow': '立即运行',
  'snippetPalette.empty': '还没有命令片段。',
  'snippetPalette.emptyCta': '添加片段',
  'snippetPalette.noMatch': '没有匹配的片段。',

  'promptPalette.title': '提示词',
  'promptPalette.search': '搜索提示词...',
  'promptPalette.enterInserts': 'Enter 插入',
  'promptPalette.addPrompt': '添加提示词',
  'promptPalette.empty': '还没有提示词。',
  'promptPalette.emptyCta': '添加提示词',
  'promptPalette.noMatch': '没有匹配的提示词。',
}

export const TRANSLATIONS: Record<Language, Translations> = { en, ru, cn }
