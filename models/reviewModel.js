const mongoose = require('mongoose');
const Tour = require('./tourModel');

const reviewSchema = new mongoose.Schema(
  {
    review: {
      type: String,
      required: [true, 'Review can not be empty'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
    },
    createdAt: {
      type: Date,
      default: Date.now(),
    },
    tour: {
      type: mongoose.Schema.ObjectId,
      ref: 'Tour',
      required: [true, 'Review must belong to a tour'],
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: [true, 'Review must belong to a user'],
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

reviewSchema.pre(/^find/, function (next) {
  this.populate({
    path: 'user',
    select: 'name photo', //esto es para que solo muestre el nombre y la foto del usuario
  });
  next();
});

//static method para calcular el promedio de ratings
reviewSchema.statics.calcAverageRatings = async function (tourId) {
  //this apunta al modelo
  const stats = await this.aggregate([
    {
      $match: { tour: tourId },
    },
    {
      $group: {
        _id: '$tour',
        nRating: { $sum: 1 },
        avgRating: { $avg: '$rating' },
      },
    },
  ]);
  //console.log(stats);
  if (stats.length > 0) {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: stats[0].nRating,
      ratingsAverage: stats[0].avgRating,
    });
  } else {
    await Tour.findByIdAndUpdate(tourId, {
      ratingsQuantity: 0,
      ratingsAverage: 4.5,
    });
  }
};

//permite que no haya reviews duplicados de un mismo usuario en un mismo tour
reviewSchema.index({ tour: 1, user: 1 }, { unique: true });

//middleware para calcular el promedio de ratings cada vez que se crea o se elimina un review
reviewSchema.post('save', function () {
  //this apunta al documento actual
  this.constructor.calcAverageRatings(this.tour);
});

//middleware para calcular el promedio de ratings cada vez que se actualiza o se elimina un review
reviewSchema.pre(/^findOneAnd/, async function (next) {
  this.r = await this.findOne();
  next();
});

//middleware para calcular el promedio de ratings cada vez que se actualiza o se elimina un review
reviewSchema.post(/^findOneAnd/, async function () {
  //await this.findOne(); does NOT work here, query has already executed
  await this.r.constructor.calcAverageRatings(this.r.tour);
});

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
