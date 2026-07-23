# Stage 1: Build the React Application
FROM node:20-alpine as build

WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the frontend code and build it
COPY . .
RUN npm run build

# Stage 2: Serve the app with Nginx
FROM nginx:alpine

# Copy the custom Nginx configuration to support React Router
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built React files from Stage 1 into the Nginx web root
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Expose port 80 (HTTP)
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
