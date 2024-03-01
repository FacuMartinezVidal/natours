const mongoose = require('mongoose');
const dotenv = require('dotenv');
//configuracion de las variables de entorno
dotenv.config({ path: './config.env' });
const app = require('./app');

//
console.log(app.get('env'));

//conexion a la base de datos
const DB = process.env.DATABASE.replace(
  '<PASSWORD>',
  process.env.DATABASE_PASSWORD,
);

//conexion a la base de datos
mongoose
  // conexion a la base de datos de manera local
  // .connect(process.env.DATABASE_LOCAL, {

  //conexion a la base de datos de manera remota (hosting)
  .connect(DB, {
    useNewUrlParser: true,
    useCreateIndex: true,
    useFindAndModify: false,
    useUnifiedTopology: true,
  })
  .then(() => console.log('DB connection successful!'));

//start server
const port = process.env.PORT || 3000;
const server = app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});

//unhandledRejection es un evento que se dispara cuando hay un error en una promesa que no fue manejado
process.on('unhandledRejection', (err) => {
  console.log(err.name, err.message);
  console.log('UNHANDLED REJECTION! 💥 Shutting down...');

  //cerrar el servidor de manera segura
  server.close(() => {
    process.exit(1);
  });
});

//uncaughtException es un evento que se dispara cuando hay un error de codigo sincronico que no fue manejado
process.on('uncaughtException', (err) => {
  console.log(err.name, err.message);
  console.log('UNCAUGHT EXCEPTION! 💥 Shutting down...');

  //cerrar el servidor de manera segura
  process.exit(1);
});
