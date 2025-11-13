# ER Diagram

<img width="1647" height="519" alt="2025-11-13-200554_1647x519_scrot" src="https://github.com/user-attachments/assets/46e7c7ff-b7ea-417e-bea1-8cddba7921d6" />

An interactive ER diagram viewer for Beekeeper Studio to visualize and explore relational database schemas.

## Development

```bash
# Clone the repo
git clone git@github.com:beekeeper-studio/bks-er-diagram.git

# Go to the directory
cd bks-er-diagram

# Link the directory to Beekeeper Studio plugins
ln -s $(pwd) ~/.config/beekeeper-studio/plugins/bks-er-diagram
# On Windows, replace $(pwd) with %cd%

# Install dependencies
yarn install

# Start development
yarn dev
```

Finally, open Beekeeper Studio 5.3 or newer (or restart the app).

## Deployment

Build the project for production:

```
yarn build
```
