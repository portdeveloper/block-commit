import * as vscode from 'vscode';
import { GitExtension, API, Repository } from '../types/git';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;
let blockCommitSourceControl: vscode.SourceControl;
let blockCommitResourceGroup: vscode.SourceControlResourceGroup;
let blockCommitDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
	outputChannel = vscode.window.createOutputChannel("Block Commit");
	outputChannel.show(true);

	const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
	const git = gitExtension?.getAPI(1);

	if (!git) {
		vscode.window.showErrorMessage('Unable to load Git Extension');
		return;
	}

	outputChannel.appendLine('Git Extension loaded');

	// Create a custom Source Control
	blockCommitSourceControl = vscode.scm.createSourceControl('blockCommit', 'Block Commit');
	blockCommitResourceGroup = blockCommitSourceControl.createResourceGroup('blockCommit', 'Block Commit Comments');

	// Hide the input box
	blockCommitSourceControl.inputBox.visible = false;

	// Create a decoration type for @block-commit
	blockCommitDecorationType = vscode.window.createTextEditorDecorationType({
		color: new vscode.ThemeColor('errorForeground'),
		fontWeight: 'bold'
	});

	git.onDidOpenRepository(repo => {
		setupGitListeners(repo);
	});

	git.repositories.forEach(repo => {
		setupGitListeners(repo);
	});

	// Register a command to force commit (for testing purposes)
	context.subscriptions.push(vscode.commands.registerCommand('extension.forceCommit', () => {
		if (blockCommitResourceGroup.resourceStates.length > 0) {
			vscode.window.showErrorMessage('Commit is blocked. Please remove @block-commit comments before committing.');
		} else {
			vscode.commands.executeCommand('git.commit');
		}
	}));

	// Register an event listener for text document changes
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(event => {
		const openEditor = vscode.window.visibleTextEditors.find(editor => editor.document === event.document);
		if (openEditor) {
			updateDecorations(openEditor);
		}
	}));

	// Register an event listener for active editor changes
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(editor => {
		if (editor) {
			updateDecorations(editor);
		}
	}));
}

function setupGitListeners(repo: Repository) {
	if (repo.state && typeof repo.state.onDidChange === 'function') {
		repo.state.onDidChange(() => {
			checkForBlockingComments(repo);
		});
		outputChannel.appendLine(`Set up listeners for repository: ${repo.rootUri.fsPath}`);
	} else {
		outputChannel.appendLine(`Warning: Unable to set up listeners for repository: ${repo.rootUri.fsPath}`);
	}
}

function updateDecorations(editor: vscode.TextEditor) {
	const text = editor.document.getText();
	const blockCommitRegex = /@block-commit/g;
	const decorations: vscode.DecorationOptions[] = [];

	let match;
	while ((match = blockCommitRegex.exec(text))) {
		const startPos = editor.document.positionAt(match.index);
		const endPos = editor.document.positionAt(match.index + match[0].length);
		const decoration = { range: new vscode.Range(startPos, endPos) };
		decorations.push(decoration);
	}

	editor.setDecorations(blockCommitDecorationType, decorations);
}

async function checkForBlockingComments(repo: Repository) {
	try {
		const diffOutput = await repo.diff() as unknown as string;

		outputChannel.appendLine(`Checking for blocking comments. Current branch: ${repo.state.HEAD?.name || 'Unknown'}`);
		outputChannel.appendLine(`Diff output length: ${diffOutput.length}`);

		const changedFiles = parseGitDiff(diffOutput);
		outputChannel.appendLine(`Number of changed files: ${changedFiles.length}`);

		const blockingComments: vscode.SourceControlResourceState[] = [];

		for (const file of changedFiles) {
			try {
				const uri = vscode.Uri.file(path.join(repo.rootUri.fsPath, file));
				const document = await vscode.workspace.openTextDocument(uri);
				const text = document.getText();

				const lines = text.split('\n');
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].includes('@block-commit')) {
						const range = new vscode.Range(i, 0, i, lines[i].length);
						blockingComments.push({
							resourceUri: uri,
							command: {
								title: "Show Block Commit",
								command: "vscode.open",
								arguments: [uri, { selection: range }]
							},
							decorations: {
								tooltip: '@block-commit found',
								iconPath: new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'))
							}
						});
					}
				}
			} catch (error) {
				outputChannel.appendLine(`Error reading file ${file}: ${error}`);
			}
		}

		blockCommitResourceGroup.resourceStates = blockingComments;

		if (blockingComments.length > 0) {
			vscode.window.showWarningMessage(`Found ${blockingComments.length} @block-commit comment(s). Commit is blocked.`);
		} else {
			outputChannel.appendLine('No blocking comments found. Commit allowed.');
		}

		vscode.window.visibleTextEditors.forEach(editor => {
			updateDecorations(editor);
		});
	} catch (error) {
		outputChannel.appendLine(`Error checking for blocking comments: ${error}`);
	}
}

function parseGitDiff(diffOutput: string): string[] {
	const lines = diffOutput.split('\n');
	const changedFiles: string[] = [];

	for (const line of lines) {
		if (line.startsWith('diff --git ')) {
			const match = line.match(/^diff --git a\/(.*) b\/(.*)$/);
			if (match && match[2]) {
				changedFiles.push(match[2]);
			}
		}
	}

	return changedFiles;
}

export function deactivate() {
	outputChannel.dispose();
	blockCommitDecorationType.dispose();
}