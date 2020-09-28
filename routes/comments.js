const express = require("express"),
  router = express.Router({
    mergeParams: true,
  }),
  Campground = require("../models/campground"),
  Comment = require("../models/comment"),
  middleware = require("../middleware");

// Add new comment form route
router.get("/new", middleware.isLoggedIn, middleware.isPaid, (req, res) => {
  Campground.findOne({ slug: req.params.slug }, (err, campground) => {
    err
      ? console.log(err)
      : res.render("comments/new", {
          campground: campground,
        });
  });
});

// New comment post route
router.post("/", middleware.isLoggedIn, middleware.isPaid, (req, res) => {
  Campground.findOne({ slug: req.params.slug }, (err, campground) => {
    if (err) {
      console.log(err);
      res.redirect("/campgrounds");
    } else {
      Comment.create(req.body.comment, (err, comment) => {
        if (err) {
          req.flash("error", "Something went wrong");
          console.log(err);
        } else {
          // add username and id to comment
          comment.author.id = req.user._id;
          comment.author.username = req.user.username;
          // save comment
          comment.save();
          campground.comments.push(comment);
          campground.save();
          req.flash("success", "Successfully added comment");
          res.redirect("/campgrounds/" + campground.slug);
        }
      });
    }
  });
});

// Edit Comment Route
router.get(
  "/:comment_id/edit",
  middleware.checkCommentOwnership,
  (req, res) => {
    Campground.findOne({ slug: req.params.slug }, (err, foundCampground) => {
      err || !foundCampground
        ? (req.flash("error", "No campground found"), res.redirect("back"))
        : Comment.findById(req.params.comment_id).then((foundComment) =>
            res.render("comments/edit", {
              campground_slug: req.params.slug,
              comment: foundComment,
            })
          );
    });
  }
);

// Comment Update Route
router.put("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
  req.flash("success", "Comment Updated");
  Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment).then(
    res.redirect("/campgrounds/" + req.params.slug)
  );
});

// Comment Delete Route
router.delete("/:comment_id", middleware.checkCommentOwnership, (req, res) => {
  req.flash("success", "Comment deleted!");
  Comment.findByIdAndRemove(req.params.comment_id).then(
    res.redirect("/campgrounds/" + req.params.slug)
  );
});

module.exports = router;
