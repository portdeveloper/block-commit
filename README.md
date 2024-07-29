# Block Commit

Block Commit is a Visual Studio Code extension that helps prevent accidental commits of unfinished code by highlighting with `@block-commit` comments.

## Features

- Automatically scans changed files for `@block-commit` comments
- Highlights `@block-commit` comments in red within the editor
- Displays a list of files containing `@block-commit` comments in the Source Control view
- Provides quick navigation to `@block-commit` comments

## Usage

1. Add `@block-commit` comments to your code where you want to prevent commits:

   ```javascript
   // @block-commit This function needs refactoring before committing
   function someUnfinishedFunction() {
     // ...
   }
   ```

2. The extension will automatically highlight these comments in red within your editor.

3. When you try to commit changes, the extension will check for @block-commit comments:

   - If found, it will add the line to the list and show a warning message
   - The Source Control view will display a list of files containing @block-commit comments

4. To remove the items from the list

   - Review the highlighted @block-commit comments
   - Make necessary changes or remove the comments
   - Once all @block-commit comments are addressed, you can proceed with your commit


## Extension Settings
This extension does not add any VS Code settings.
Known Issues
Please report any issues on the GitHub repository.
Release Notes
0.0.1
Initial release of Block Commit

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
License
This extension is licensed under the MIT License.