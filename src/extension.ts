import * as vscode from 'vscode';
import { GitExtension, API, Repository } from '../types/git';
import * as path from 'path';

let outputChannel: vscode.OutputChannel;

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

    git.onDidOpenRepository(repo => {
        setupGitListeners(repo);
    });

    git.repositories.forEach(repo => {
        setupGitListeners(repo);
    });
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

        for (const file of changedFiles) {
            try {
                const uri = vscode.Uri.file(path.join(repo.rootUri.fsPath, file));
                const document = await vscode.workspace.openTextDocument(uri);
                const text = document.getText();
				outputChannel.appendLine(text);

				

                if (text.includes('@block-commit')) {
                    const message = `Commit blocked: @block-commit comment found in ${file}`;
                    vscode.window.showErrorMessage(message);
                    outputChannel.appendLine(message);
                    if (repo.inputBox && typeof repo.inputBox.value === 'string') {
                        repo.inputBox.value = ''; // Clear commit message to prevent commit
                    }
                    return;
                }
            } catch (error) {
                outputChannel.appendLine(`Error reading file ${file}: ${error}`);
            }
        }

        outputChannel.appendLine('No blocking comments found. Commit allowed.');
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
}