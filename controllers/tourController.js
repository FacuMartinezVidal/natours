const multer = require('multer');
const sharp = require('sharp');
const catchAsync = require('../utils/catchAsync');
const Tour = require('../models/tourModel');
const factory = require('./handlerFactory');
const AppError = require('../utils/appError');

// const tours = JSON.parse(
//   fs.readFileSync(`${__dirname}/../dev-data/data/tours-simple.json`),
// );

exports.getAllTours = factory.getAll(Tour);
exports.getTour = factory.getOne(Tour, { path: 'reviews' });
exports.createTour = factory.createOne(Tour);
exports.updateTour = factory.updateOne(Tour);
exports.deleteTour = factory.deleteOne(Tour);

const multerStorage = multer.memoryStorage();
const multerFilter = (req, file, cb) => {
  //si el archivo es una imagen
  if (file.mimetype.startsWith('image')) {
    //true para que se suba la imagen
    cb(null, true);
  } else {
    cb(new AppError('Not an image! Please upload only images.', 400), false);
  }
};

const upload = multer({
  storage: multerStorage,
  fileFilter: multerFilter,
});

exports.uploadTourImages = upload.fields([
  { name: 'imageCover', maxCount: 1 },
  { name: 'images', maxCount: 3 },
]);

exports.resizeTourImages = catchAsync(async (req, res, next) => {
  if (!req.files.imageCover || !req.files.images) return next();
  //1) Cover image
  req.body.imageCover = `tour-${req.params.id}-${Date.now()}-cover.jpeg`;
  await sharp(req.files.imageCover[0].buffer)
    .resize(2000, 1333)
    .toFormat('jpeg')
    .jpeg({ quality: 90 })
    .toFile(`public/img/tours/${req.body.imageCover}`);
  //2) Images
  req.body.images = [];
  await Promise.all(
    req.files.images.map(async (file, i) => {
      const filename = `tour-${req.params.id}-${Date.now()}-${i + 1}.jpeg`;
      await sharp(file.buffer)
        .resize(2000, 1333)
        .toFormat('jpeg')
        .jpeg({ quality: 90 })
        .toFile(`public/img/tours/${filename}`);
      req.body.images.push(filename);
    }),
  );
  next();
});

//aliasing middleware
exports.aliasTopTours = (req, res, next) => {
  req.query.limit = '5';
  req.query.sort = '-ratingsAverage,price';
  req.query.fields = 'name,price,ratingsAverage,summary,difficulty';
  next();
};

//aggregation pipeline, esto es para obtener estadisticas
exports.getTourStats = catchAsync(async (req, res) => {
  const stats = await Tour.aggregate([
    {
      $match: { ratingAverage: { $gte: 4.5 } },
    },
    {
      $group: {
        _id: { $toUpper: '$difficulty' },
        numTours: { $sum: 1 }, //esto suma 1 por cada documento que se agrupa
        numRatings: { $sum: '$ratingQuantity' }, //esto suma el valor de ratingQuantity por cada documento que se agrupa
        avgRating: { $avg: '$ratingAverage' },
        avgPrice: { $avg: '$price' },
        minPrice: { $min: '$price' },
        maxPrice: { $max: '$price' },
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: { stats },
  });
});

//aggregation pipeline
exports.getMonthlyPlan = catchAsync(async (req, res) => {
  const year = req.params.year * 1; //2021
  const plan = await Tour.aggregate([
    {
      $unwind: '$startDates', //esto descompone el array de startDates en documentos separados
    },
    {
      $match: {
        startDates: {
          $gte: new Date(`${year}-01-01`),
          $lte: new Date(`${year}-12-31`),
        },
      },
    },
    {
      $group: {
        _id: { $month: '$startDates' },
        numTourStarts: { $sum: 1 }, //esto suma 1 por cada documento que se agrupa
        tours: { $push: '$name' }, //esto agrega el nombre del tour a un array por cada documento que se agrupa
      },
    },
    {
      $addFields: { month: '$_id' }, //esto agrega un campo llamado month con el valor de _id
    },
    {
      $project: {
        _id: 0, //esto es para que no se muestre el campo _id
      },
    },
    {
      $sort: { numTourStarts: -1 }, //esto ordena los documentos por numTourStarts de manera descendente
    },
    {
      $limit: 12, //esto limita el numero de documentos a 12
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: { plan },
  });
});

//tour-within/:distance/center/:latlng/unit/:unit
//tour-within/233/center/-40,45/unit/mi
exports.getToursWithin = catchAsync(async (req, res, next) => {
  const { distance, latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  const radius = unit === 'mi' ? distance / 3963.2 : distance / 6378.1;
  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400,
      ),
    );
  }
  const tours = await Tour.find({
    startLocation: { $geoWithin: { $centerSphere: [[lng, lat], radius] } },
  });
  res.status(200).json({
    status: 'success',
    results: tours.length,
    data: { data: tours },
  });
});

exports.getDistances = catchAsync(async (req, res, next) => {
  const { latlng, unit } = req.params;
  const [lat, lng] = latlng.split(',');
  //esto es para convertir la distancia a metros o millas
  const multiplier = unit === 'mi' ? 0.000621371 : 0.001;
  if (!lat || !lng) {
    return next(
      new AppError(
        'Please provide latitude and longitude in the format lat,lng.',
        400,
      ),
    );
  }
  //esto es para calcular la distancia entre dos puntos y usamos aggregation pipeline
  const distances = await Tour.aggregate([
    {
      //esto es para buscar tours cerca de un punto
      $geoNear: {
        //el punto de referencia
        near: {
          type: 'Point',
          coordinates: [lng * 1, lat * 1],
        },
        //esto es para especificar el campo que contiene la distancia
        distanceField: 'distance',
        //esto es para especificar la distancia en metros
        distanceMultiplier: multiplier,
      },
    },
    {
      //esto es para mostrar solo los campos que queremos
      $project: {
        distance: 1,
        name: 1,
      },
    },
  ]);
  res.status(200).json({
    status: 'success',
    data: { data: distances },
  });
});
