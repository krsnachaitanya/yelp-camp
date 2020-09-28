const middleware = require("../middleware");

const express = require("express"),
  router = express.Router(),
  passport = require("passport"),
  async = require("async"),
  nodemailer = require("nodemailer"),
  crypto = require("crypto"),
  User = require("../models/user"),
  Campground = require("../models/campground"),
  Comment = require("../models/comment");

// Set your secret key. Remember to switch to your live secret key in production!
// See your keys here: https://dashboard.stripe.com/account/apikeys
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

// Root route
router.get("/", (req, res) => {
  res.render("landing");
});

// Show register form
router.get("/register", (req, res) =>
  res.render("register", {
    page: "register",
  })
);

// Handle sign up logic
router.post("/register", (req, res) => {
  const newUser = new User({
    username: req.body.username,
    email: req.body.email,
  });
  if (req.body.adminCode === process.env.SECRETADMINCODEAPP) {
    newUser.isAdmin = true;
  }
  User.register(newUser, req.body.password, (err, user) => {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/register");
    }
    passport.authenticate("local")(req, res, () => {
      req.flash("success", "Welcome to YelpCamp " + user.username);
      res.redirect("/checkout");
    });
  });
});

// Show login page
router.get("/login", (req, res) =>
  res.render("login", {
    page: "login",
  })
);

// Handle login logic
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
  }),
  (req, res) => {}
);

// Logout Route
router.get("/logout", (req, res) => {
  req.logout();
  req.flash("success", "Logged out!");
  res.redirect("/campgrounds");
});

// forgot password
router.get("/forgot", (req, res) => res.render("forgot"));

router.post("/forgot", function (req, res, next) {
  async.waterfall(
    [
      function (done) {
        crypto.randomBytes(20, function (err, buf) {
          var token = buf.toString("hex");
          done(err, token);
        });
      },
      function (token, done) {
        User.findOne({ email: req.body.email }, function (err, user) {
          if (!user) {
            req.flash("error", "No account with that email address exists.");
            return res.redirect("/forgot");
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.save(function (err) {
            done(err, token, user);
          });
        });
      },
      function (token, user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "chaitu.matchpoint@gmail.com",
            pass: process.env.GMAILPW,
          },
        });
        var mailOptions = {
          to: user.email,
          from: "chaitu.matchpoint@gmail.com",
          subject: "YelpCamp Password Reset",
          text:
            "You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n" +
            "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
            "http://" +
            req.headers.host +
            "/reset/" +
            token +
            "\n\n" +
            "If you did not request this, please ignore this email and your password will remain unchanged.\n",
        };
        smtpTransport.sendMail(mailOptions, function (err) {
          console.log("mail sent");
          req.flash(
            "success",
            "An e-mail has been sent to " +
              user.email +
              " with further instructions."
          );
          done(err, "done");
        });
      },
    ],
    function (err) {
      if (err) return next(err);
      res.redirect("/forgot");
    }
  );
});

// Reset password route
router.get("/reset/:token", function (req, res) {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() },
    },
    function (err, user) {
      if (!user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
      }
      res.render("reset", { token: req.params.token });
    }
  );
});

router.post("/reset/:token", function (req, res) {
  async.waterfall(
    [
      function (done) {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() },
          },
          function (err, user) {
            if (!user) {
              req.flash(
                "error",
                "Password reset token is invalid or has expired."
              );
              return res.redirect("back");
            }
            if (req.body.password === req.body.confirm) {
              user.setPassword(req.body.password, function (err) {
                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save(function (err) {
                  req.logIn(user, function (err) {
                    done(err, user);
                  });
                });
              });
            } else {
              req.flash("error", "Passwords do not match.");
              return res.redirect("back");
            }
          }
        );
      },
      function (user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "chaitu.matchpoint@gmail.com",
            pass: process.env.GMAILPW,
          },
        });
        var mailOptions = {
          to: user.email,
          from: "chaitu.matchpoint@mail.com",
          subject: "Your password has been changed - YelpCamp",
          text:
            "Hello,\n\n" +
            "This is a confirmation that the password for your account " +
            user.email +
            " has just been changed.\n",
        };
        smtpTransport.sendMail(mailOptions, function (err) {
          req.flash("success", "Success! Your password has been changed.");
          done(err);
        });
      },
    ],
    function (err) {
      res.redirect("/campgrounds");
    }
  );
});

// User Profile
router.get("/user/:user_id", middleware.isLoggedIn, (req, res) => {
  User.findById(req.params.user_id, (err, foundUser) => {
    if (err || !foundUser) {
      req.flash("error", "User not Found");
      res.redirect("back");
    } else {
      Campground.find()
        .where("author.id")
        .equals(foundUser._id)
        .exec((err, campgrounds) => {
          if (err) {
            req.flash("error", "Something went wrong.");
            res.redirect("back");
          }
          res.render("users/show", {
            user: foundUser,
            currentUser: req.user,
            campgrounds: campgrounds,
          });
        });
    }
  });
});

// User profile edit route
router.get(
  "/user/:user_id/edit",
  middleware.checkProfileOwnership,
  middleware.isPaid,
  (req, res) => {
    User.findById(req.params.user_id, (err, foundUser) => {
      err || !foundUser
        ? (req.flash("error", "User not Found"), res.redirect("back"))
        : res.render("users/edit", {
            user: foundUser,
          });
    });
  }
);

// User profile update route
router.put(
  "/user/:user_id",
  middleware.checkProfileOwnership,
  middleware.isPaid,
  (req, res) => {
    let id = req.params.user_id;
    User.findOne({ _id: id }, (err, foundUser) => {
      if (err || !foundUser) {
        req.flash("error", "User not Found");
        res.redirect("back");
      } else {
        if (req.body.adminCode === "SecretCode123") {
          foundUser.isAdmin = true;
          foundUser.save();
        }
      }
    });
    User.findByIdAndUpdate(id, req.body.user).then(
      req.flash("success", "User profile updated"),
      res.redirect("/user/" + id)
    );
  }
);

/* ===== Admin Routes ===== */
// Admin dashboard
router.get("/dashboard", (req, res) => res.render("admin/dashboard"));

// Checkout route
router.get("/checkout", middleware.isLoggedIn, (req, res) => {
  if (req.user.isPaid) {
    req.flash("success", "You are already a premium subscriber!");
    res.redirect("/campgrounds");
  }
  res.render("checkout", {
    amount: 2000,
  });
});

// POST pay route
router.post("/pay", middleware.isLoggedIn, async (req, res) => {
  const { paymentMethodId, items, currency } = req.body;

  const amount = 2000;

  try {
    // Create new PaymentIntent with a PaymentMethod ID from the client.
    const intent = await stripe.paymentIntents.create({
      amount,
      currency,
      payment_method: paymentMethodId,
      error_on_requires_action: true,
      confirm: true,
    });

    console.log("💰 Payment received!");

    req.user.isPaid = true;
    await req.user.save();
    // The payment is complete and the money has been moved
    // You can add any post-payment code here (e.g. shipping, fulfillment, etc)

    // Send the client secret to the client to use in the demo
    res.send({
      clientSecret: intent.client_secret,
    });
  } catch (e) {
    // Handle "hard declines" e.g. insufficient funds, expired card, card authentication etc
    // See https://stripe.com/docs/declines/codes for more
    if (e.code === "authentication_required") {
      res.send({
        error:
          "This card requires authentication in order to proceeded. Please use a different card.",
      });
    } else {
      res.send({
        error: e.message,
      });
    }
  }
});

module.exports = router;
