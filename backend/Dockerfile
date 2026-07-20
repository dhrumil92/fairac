# Use an official, lightweight Node.js image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first
# This takes advantage of Docker's caching to speed up builds
COPY package*.json ./

# Install only production dependencies (saves space and time)
RUN npm install --only=production

# Copy the rest of the backend source code
COPY . .

# Expose the port the app runs on
EXPOSE 5000

# Start the application
CMD ["npm", "start"]
