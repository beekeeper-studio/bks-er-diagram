# ER Diagram

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
