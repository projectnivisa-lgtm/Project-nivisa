FROM node:20-alpine

WORKDIR /app

# Installed before the source is copied, so editing a component does not
# reinstall the dependency tree.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 5174

CMD ["npm", "run", "dev"]
