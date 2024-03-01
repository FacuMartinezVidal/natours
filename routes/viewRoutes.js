const express = require('express');
const {
  getOverview,
  getTour,
  getLoginForm,
  getSignUpForm,
  getAccount,
  getMyTours,
} = require('../controllers/viewsController');

const { createBookingCheckout } = require('../controllers/bookingController');

const { isLoggedIn, protect } = require('../controllers/authController');

const router = express.Router();

//middleware para renderizar html

router.get('/', createBookingCheckout, isLoggedIn, getOverview);
router.get('/tour/:slug', protect, isLoggedIn, getTour);
router.get('/login', isLoggedIn, getLoginForm);
router.get('/signup', isLoggedIn, getSignUpForm);
router.get('/me', protect, getAccount);
router.get('/my-tours', protect, getMyTours);
module.exports = router;
