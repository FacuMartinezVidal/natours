const path = require('path');
const express = require('express');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controllers/errorController');
const tourRouter = require('./routes/tourRoutes'); //importamos el router de tours
const userRouter = require('./routes/userRoutes'); //importamos el router de users
const reviewRouter = require('./routes/reviewRoutes'); //importamos el router de reviews
const viewRouter = require('./routes/viewRoutes'); //importamos el router de vistas
const bookingRouter = require('./routes/bookingRoutes'); //importamos el router de bookings

const app = express();

//helmet middleware, establece headers http seguros
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'", 'https:', 'http:', 'data:', 'ws:'],
      baseUri: ["'self'"],
      fontSrc: ["'self'", 'https:', 'http:', 'data:'],
      scriptSrc: ["'self'", 'https:', 'http:', 'blob:'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https:', 'http:'],
    },
  }),
);

//establecemos el motor de plantillas pug, para renderizar html
app.set('view engine', 'pug');
//establecemos la carpeta donde estan las plantillas con modulo path
//path.join une las rutas de forma segura, independientemente del sistema operativo
app.set('views', path.join(__dirname, 'views'));

//middleware que sirve para archivos estaticos (html, css, imagenes, etc)
app.use(express.static(path.join(__dirname, 'public')));
//miidleware para leer cookies de la request
app.use(cookieParser());

//morgan middleware
//dev es un formato de morgan que muestra en consola informacion de la request\
if (process.env.NODE_ENV === 'development') {
  //si estamos en desarrollo, usamos morgan
  //morgan es un middleware que muestra en consola informacion de la request
  app.use(morgan('dev'));
}

//limitador de requests
const limiter = rateLimit({
  max: 100, //100 requests
  windowMs: 60 * 60 * 1000, //1 hora en milisegundos
  message: 'Too many requests from this IP, please try again in an hour',
});

//limiter middlaware, que aplica a todas las rutas que empiecen con /api
app.use('/api', limiter);

//body parser middleware  que convierte el body de la request a json
//limitamos el tamaño del body a 10kb, para evitar ataques de denegacion de servicio
app.use(express.json({ limit: '10kb' }));

//middleware sanitizacion de datos, contra NoSQL query injections como $gt, $gte, etc
app.use(mongoSanitize());

//middleware para protegerse contra ataques XSS, limpiando el html de los datos
app.use(xss());

//middleware para protegerse contra ataques de polucion de parametros http
app.use(
  hpp(
    //parametros que permitimos duplicados en el query string
    {
      whitelist: [
        'duration',
        'ratingsQuantity',
        'ratingsAverage',
        'maxGroupSize',
        'difficulty',
        'price',
      ],
    },
  ),
);

//middleware que agrega la fecha y hora de la request a la request
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();
  next();
});

//montamos los routers, los cuales son middlewares
app.use('/', viewRouter);
app.use('/api/v1/tours', tourRouter);
app.use('/api/v1/users', userRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

//middleware para manejar rutas no definidas
app.all('*', (req, res, next) => {
  // const err = new Error(`Can't find ${req.originalUrl} on this server!`);
  // err.statusCode = 404;
  // err.status = 'fail';
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

//middleware para manejar errores
app.use(globalErrorHandler);

module.exports = app;
