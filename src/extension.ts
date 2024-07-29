import * as vscode from 'vscode';
import { GitExtension, API, Repository } from '../types/git';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;
let isCommitBlocked = false;
let scmInputBox: vscode.SourceControlInputBox | undefined;

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
	const blockCommitSourceControl = vscode.scm.createSourceControl('blockCommit', 'Block Commit');
	scmInputBox = blockCommitSourceControl.inputBox;

	git.onDidOpenRepository(repo => {
		setupGitListeners(repo);
	});

	git.repositories.forEach(repo => {
		setupGitListeners(repo);
	});

	// Register a command to force commit (for testing purposes)
	context.subscriptions.push(vscode.commands.registerCommand('extension.forceCommit', () => {
		if (isCommitBlocked) {
			vscode.window.showErrorMessage('Commit is blocked. Please remove @block-commit comments before committing.');
		} else {
			vscode.commands.executeCommand('git.commit');
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

async function checkForBlockingComments(repo: Repository) {
	try {
		const diffOutput = await repo.diff() as unknown as string;

		outputChannel.appendLine(`Checking for blocking comments. Current branch: ${repo.state.HEAD?.name || 'Unknown'}`);
		outputChannel.appendLine(`Diff output length: ${diffOutput.length}`);

		const changedFiles = parseGitDiff(diffOutput);
		outputChannel.appendLine(`Number of changed files: ${changedFiles.length}`);

		isCommitBlocked = false;

		for (const file of changedFiles) {
			try {
				const uri = vscode.Uri.file(path.join(repo.rootUri.fsPath, file));
				const document = await vscode.workspace.openTextDocument(uri);
				const text = document.getText();

				if (text.includes('@block-commit')) {
					const message = `Commit blocked: @block-commit comment found in ${file}`;
					vscode.window.showErrorMessage(message);
					outputChannel.appendLine(message);
					isCommitBlocked = true;
					updateSCMInputBox(message);
					return;
				}
			} catch (error) {
				outputChannel.appendLine(`Error reading file ${file}: ${error}`);
			}
		}

		if (!isCommitBlocked) {
			updateSCMInputBox('');
			outputChannel.appendLine('No blocking comments found. Commit allowed.');
		}
	} catch (error) {
		outputChannel.appendLine(`Error checking for blocking comments: ${error}`);
	}
}

function updateSCMInputBox(message: string) {
	if (scmInputBox) {
		scmInputBox.value = message;
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
}