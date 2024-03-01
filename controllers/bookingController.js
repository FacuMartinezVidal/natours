const mercadopago = require('mercadopago');
const factory = require('./handlerFactory');
const Booking = require('../models/bookingModel');
const catchAsync = require('../utils/catchAsync');

const { MercadoPagoConfig, Preference } = mercadopago;
const Tour = require('../models/tourModel');

exports.createOrder = async (req, res) => {
  console.log();
  const tour = await Tour.findById(req.params.tourId);
  const client = new MercadoPagoConfig({
    accessToken: process.env.ACCES_TOKEN,
  });
  const payment = new Preference(client);
  const body = {
    back_urls: {
      success: `${req.protocol}://${req.get('host')}/my-tours/?tour=${
        req.params.tourId
      }&user=${req.user.id}&price=${tour.price}`,
      failure: `${req.protocol}://${req.get('host')}/tour/${tour.slug}`,
    },
    items: [
      {
        id: req.params.tourId,
        title: tour.name,
        quantity: 1,
        unit_price: tour.price,
      },
    ],
  };

  const result = await payment.create({ body });
  console.log(result);
  res.status(200).json({
    status: 'success',
    data: result,
  });
};

exports.createBookingCheckout = catchAsync(async (req, res, next) => {
  // This is only TEMPORARY, because it's UNSECURE: everyone can make bookings without paying
  const { tour, user, price } = req.query;

  if (!tour && !user && !price) return next();
  await Booking.create({ tour, user, price });

  res.redirect(req.originalUrl.split('?')[0]);
});

exports.createBooking = factory.createOne(Booking);
exports.getBooking = factory.getOne(Booking);
exports.getAllBookings = factory.getAll(Booking);
exports.updateBooking = factory.updateOne(Booking);
exports.deleteBooking = factory.deleteOne(Booking);
