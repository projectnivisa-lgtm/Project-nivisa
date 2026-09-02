FROM node:20-alpine

WORKDIR /app

# Installed before the source is copied, so editing a page does not reinstall
# the dependency tree.
COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]
