# Slalom Tools
Python + JavaScript web app that helps manage freestyle slalom sports competitions.

To run the backend, enter the backend folder and:
```
uvicorn --timeout-keep-alive 1 --timeout-graceful-shutdown 1 main:app
```

To run the frontend, enter the frontend folder and:
```
npm run start-no-prompt
```
