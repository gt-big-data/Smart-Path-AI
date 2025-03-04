## To Create and Run the Docker Image

```bash
docker build --no-cache -t flask-app .
docker run -d -p 5000:5000 flask-app
```
