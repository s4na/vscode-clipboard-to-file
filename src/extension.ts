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
