// package.json
{
  "name": "clipboard-to-file",
  "displayName": "Clipboard to File",
  "description": "クリップボードの内容から新規ファイルを作成する拡張機能",
  "version": "0.0.1",
  "engines": {
    "vscode": "^1.60.0"
  },
  "categories": [
    "Other"
  ],
  "activationEvents": [
    "onCommand:clipboard-to-file.createFile"
  ],
  "main": "./dist/extension.js",
  "contributes": {
    "commands": [
      {
        "command": "clipboard-to-file.createFile",
        "title": "クリップボードから新規ファイル作成"
      }
    ],
    "keybindings": [
      {
        "command": "clipboard-to-file.createFile",
        "key": "ctrl+alt+n",
        "mac": "cmd+alt+n"
      }
    ],
    "menus": {
      "explorer/context": [
        {
          "command": "clipboard-to-file.createFile",
          "group": "navigation"
        }
      ]
    }
  },
  "scripts": {
    "vscode:prepublish": "npm run package",
    "compile": "webpack",
    "watch": "webpack --watch",
    "package": "webpack --mode production --devtool hidden-source-map",
    "lint": "eslint src --ext ts"
  },
  "devDependencies": {
    "@types/node": "^16.11.7",
    "@types/vscode": "^1.60.0",
    "@typescript-eslint/eslint-plugin": "^5.30.0",
    "@typescript-eslint/parser": "^5.30.0",
    "eslint": "^8.13.0",
    "ts-loader": "^9.3.0",
    "typescript": "^4.7.2",
    "webpack": "^5.73.0",
    "webpack-cli": "^4.9.2"
  }
}

// src/extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand('clipboard-to-file.createFile', async () => {
    try {
      // クリップボードからテキストを取得
      const clipboardText = await vscode.env.clipboard.readText();
      
      if (!clipboardText) {
        vscode.window.showErrorMessage('クリップボードにテキストがありません');
        return;
      }
      
      // ファイル名の検出を試みる
      const fileNameMatch = clipboardText.match(/^(.*\.[\w]+)/m);
      let suggestedFileName = '';
      
      // コードの最初の行にファイル名が記述されているかチェック
      if (fileNameMatch && fileNameMatch[1]) {
        suggestedFileName = fileNameMatch[1].trim();
      } else {
        // ファイル拡張子を検出
        const pythonRegex = /^import\s|^from\s|def\s|class\s/m;
        const htmlRegex = /<!DOCTYPE html>|<html>|<head>|<body>/m;
        const javascriptRegex = /function\s|const\s|let\s|var\s|import\s|export\s/m;
        const typescriptRegex = /interface\s|type\s|namespace\s/m;
        
        if (pythonRegex.test(clipboardText)) {
          suggestedFileName = 'new_file.py';
        } else if (htmlRegex.test(clipboardText)) {
          suggestedFileName = 'new_file.html';
        } else if (typescriptRegex.test(clipboardText)) {
          suggestedFileName = 'new_file.ts';
        } else if (javascriptRegex.test(clipboardText)) {
          suggestedFileName = 'new_file.js';
        } else {
          suggestedFileName = 'new_file.txt';
        }
      }
      
      // ユーザーにファイル名を入力してもらう
      const fileName = await vscode.window.showInputBox({
        prompt: 'ファイル名を入力してください',
        value: suggestedFileName
      });
      
      if (!fileName) {
        return; // ユーザーがキャンセルした場合
      }
      
      // 現在のワークスペースフォルダを取得
      let targetUri: vscode.Uri | undefined;
      
      if (vscode.window.activeTextEditor && vscode.window.activeTextEditor.document.uri.scheme === 'file') {
        // アクティブなエディタがある場合、そのフォルダを使用
        const activeDocPath = path.dirname(vscode.window.activeTextEditor.document.uri.fsPath);
        targetUri = vscode.Uri.file(activeDocPath);
      } else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
        // ワークスペースフォルダがある場合、最初のフォルダを使用
        targetUri = vscode.workspace.workspaceFolders[0].uri;
      }
      
      // エクスプローラーで選択されているフォルダを確認
      if (vscode.window.activeTextEditor === undefined && vscode.window.state.focused) {
        const explorerItems = await vscode.commands.executeCommand<vscode.Uri[]>('filesExplorer.getSelectedForCommand');
        if (explorerItems && explorerItems.length > 0) {
          const stats = await vscode.workspace.fs.stat(explorerItems[0]);
          if (stats.type === vscode.FileType.Directory) {
            targetUri = explorerItems[0];
          } else {
            // ファイルが選択されている場合は、そのフォルダを使用
            targetUri = vscode.Uri.file(path.dirname(explorerItems[0].fsPath));
          }
        }
      }
      
      if (!targetUri) {
        vscode.window.showErrorMessage('ファイルを作成する場所が特定できません');
        return;
      }
      
      // 新しいファイルのパスを作成
      const newFilePath = path.join(targetUri.fsPath, fileName);
      const newFileUri = vscode.Uri.file(newFilePath);
      
      // ファイルが既に存在するか確認
      try {
        await vscode.workspace.fs.stat(newFileUri);
        // ファイルが存在する場合
        const overwrite = await vscode.window.showWarningMessage(
          `${fileName} は既に存在します。上書きしますか？`,
          { modal: true },
          '上書き'
        );
        
        if (overwrite !== '上書き') {
          return;
        }
      } catch (err) {
        // ファイルが存在しない場合は何もしない（続行）
      }
      
      // ファイルを作成して内容を書き込む
      const fileContent = new TextEncoder().encode(clipboardText);
      await vscode.workspace.fs.writeFile(newFileUri, fileContent);
      
      // 作成したファイルを開く
      const document = await vscode.workspace.openTextDocument(newFileUri);
      await vscode.window.showTextDocument(document);
      
      vscode.window.showInformationMessage(`${fileName} を作成しました`);
    } catch (err) {
      vscode.window.showErrorMessage(`エラーが発生しました: ${err}`);
    }
  });
  
  context.subscriptions.push(disposable);
}

export function deactivate() {}

// README.md
# Clipboard to File Extension

この拡張機能は、クリップボードの内容を使って新しいファイルを作成するためのVSCode拡張機能です。

## 機能

- クリップボードの内容から新しいファイルを作成します
- ファイル内容から適切なファイル拡張子を自動的に判断します
- ショートカットキー（Ctrl+Alt+N / Cmd+Alt+N）でクイック実行できます
- エクスプローラーコンテキストメニューからも実行できます

## 使い方

1. 作成したいファイルの内容をクリップボードにコピーします
2. VSCode内で以下の方法のいずれかで拡張機能を実行します:
   - コマンドパレット（Ctrl+Shift+P / Cmd+Shift+P）から「クリップボードから新規ファイル作成」を選択
   - ショートカットキー Ctrl+Alt+N（Macの場合は Cmd+Alt+N）を押す
   - エクスプローラーの任意のフォルダを右クリックし、コンテキストメニューから「クリップボードから新規ファイル作成」を選択
3. ファイル名を入力するプロンプトが表示されます（内容によって適切な拡張子が提案されます）
4. ファイル名を確定するとファイルが作成され、エディタで開かれます

## 注意点

- クリップボードに内容がない場合はエラーメッセージが表示されます
- 同名のファイルが既に存在する場合は、上書きの確認が表示されます
