const Campground = require("../models/campground"),
  User = require("../models/user"),
  Comment = require("../models/comment");

const middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function (req, res, next) {
  // is user logged in
  if (req.isAuthenticated()) {
    Campground.findOne({ slug: req.params.slug }, (err, foundCampground) => {
      err || !foundCampground
        ? (req.flash("error", "Campground not found"), res.redirect("back"))
        : // does user own the campground
        // if not, redirect
        foundCampground.author.id.equals(req.user._id) || req.user.isAdmin
        ? next()
        : (req.flash("error", "You don't have permission to do that"),
          res.redirect("back"));
    });
  } else {
    // otherwise, redirect
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("back");
  }
};

middlewareObj.checkCommentOwnership = function (req, res, next) {
  // is user logged in
  if (req.isAuthenticated()) {
    Comment.findById(req.params.comment_id, (err, foundComment) => {
      err || !foundComment
        ? (req.flash("error", "Comment not found"), res.redirect("back"))
        : // does user own the comment
        // if not, redirect
        foundComment.author.id.equals(req.user._id) || req.user.isAdmin
        ? next()
        : (req.flash("error", "You don't have permission to do that"),
          res.redirect("back"));
    });
  } else {
    // otherwise, redirect
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("back");
  }
};

// Check if user is loggedin
middlewareObj.isLoggedIn = function (req, res, next) {
  req.isAuthenticated()
    ? next()
    : (req.flash("error", "You need to be logged in to do that!"),
      res.redirect("/login"));
};

// Check if user is paid
middlewareObj.isPaid = function (req, res, next) {
  if (req.user.isPaid) return next();
  req.flash("error", "Please pay registration fee before continuing!");
  res.redirect("/checkout");
};

middlewareObj.checkProfileOwnership = function (req, res, next) {
  // is user logged in
  if (req.isAuthenticated()) {
    User.findById(req.params.user_id, (err, foundUser) => {
      err || !foundUser
        ? (req.flash("error", "User not found"), res.redirect("back"))
        : // does user own the profile
        // if not, redirect
        foundUser._id.equals(req.user._id)
        ? next()
        : (req.flash("error", "You don't have permission to do that"),
          res.redirect("back"));
    });
  } else {
    // otherwise, redirect
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("back");
  }
};

module.exports = middlewareObj;
