# TL;DR
* "/server" directory contains all the backend functionality (database stuff and google auth implementation).
* "/src" directory contains all the pages for the website - basically the frontend.
* Bolt made the project structure kinda weird so some of the files in the front end are outside of the src directory.
* Make sure to run "npm install" at both the root level and within the server directory to install all the dependencies listed in the package.json files.
* Now running "npm run dev" at the root level should run both front and back end simultaneously - You should see something like this in your terminal :

  ## Example Terminal output:
          npm run dev                                                       
          
          > vite-react-typescript-starter@0.0.0 dev
          > concurrently "npm run dev:server" "npm run dev:client"
          
          [1] 
          [1] > vite-react-typescript-starter@0.0.0 dev:client
          [1] > vite
          [1] 
          [0] 
          [0] > vite-react-typescript-starter@0.0.0 dev:server
          [0] > cd server && npm run dev
          [0]
          [1] 
          [1]   VITE v5.4.8  ready in 236 ms
          [1]
          [1]   ➜  Local:   http://localhost:5173/
          [1]   ➜  Network: use --host to expose
          [0] 
          [0] > server@1.0.0 dev
          [0] > npx ts-node --project tsconfig.json index.ts
          [0]
          [0] Server running on http://localhost:4000
          [0] MongoDB connected


```