pm2 stop ai
pm2 stop main
pm2 delete ai
pm2 delete main

cd /projects
git pull

cd /projects/ai
npm install
npm run build
PORT=4000 pm2 start npm --name "ai" -- run start

cd /projects/main
npm install
npm run build
PORT=3000 pm2 start npm --name "main" -- run start

pm2 startup
pm2 save
