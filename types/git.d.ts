import { Uri, Event, Disposable, ProviderResult } from 'vscode';

export interface GitExtension {
    getAPI(version: number): API;
}

export interface API {
    readonly repositories: Repository[];
    onDidChangeState: Event<void>;
    onDidOpenRepository: Event<Repository>;
}

export interface Repository {
    readonly rootUri: Uri;
    readonly inputBox?: InputBox;
    readonly state: RepositoryState;
    diff(cached?: boolean): Promise<string>;
}

export interface InputBox {
    value?: string;
    onDidChangeValue?: Event<string>;
}

export interface Change {
    readonly uri?: Uri;
    readonly resourceUri?: Uri;
    [key: string]: any;  // Allow for other properties
}

export interface RepositoryState {
    readonly HEAD: Branch | undefined;
    readonly onDidChange: Event<void>;
}

export interface Branch {
    readonly name: string;
    readonly commit: string;
    readonly upstream: Branch | undefined;
}

export interface Remote {
    readonly name: string;
    readonly fetchUrl: string | undefined;
    readonly pushUrl: string | undefined;
    readonly isReadOnly: boolean;
}

export interface Ref {
    readonly type: RefType;
    readonly name: string;
    readonly commit: string;
}

export enum RefType {
    Head,
    RemoteHead,
    Tag
}

export interface Submodule {
    readonly name: string;
    readonly path: string;
    readonly url: string;
}

export interface Commit {
    readonly hash: string;
    readonly message: string;
}