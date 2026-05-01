pm2 stop ai
pm2 stop main
pm2 delete ai
pm2 delete main

cd /dwipa
git pull

cd /dwipa/ai
npm install
npm run build
PORT=4000 pm2 start npm --name "ai" -- run start

cd /dwipa/main
npm install
npm run build
PORT=3000 pm2 start npm --name "main" -- run start

pm2 startup
pm2 save