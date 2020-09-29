const express = require("express"),
  router = express.Router(),
  expressSanitizer = require("express-sanitizer"),
  Campground = require("../models/campground"),
  middleware = require("../middleware");

// Map Routes
// Map route for campground show page
router.get("/mapview", (req, res) => res.render("campgrounds/mapview"));

// Map route for campground new and update page
router.get("/mapform", (req, res) => res.render("campgrounds/mapform"));

// Index route - show all campgrounds
router.get("/", (req, res) => {
  if (req.query.paid)
    res.locals.success = "Payment succeded, welcome to YelpCamp!";
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    Campground.find({ name: regex }, (err, searchedCampgrounds) => {
      if (err) {
        req.flash("error", "Campground not found");
        res.redirect("back");
      } else if (searchedCampgrounds.length < 1) {
        // Notify user if no campground is found
        req.flash(
          "error",
          `Sorry, we can't seem to find any campground with title "${req.query.search}". Try again with different search terms.`
        );
        res.redirect("back");
      } else {
        res.render("campgrounds/index", {
          campgrounds: searchedCampgrounds,
          searchTerm: req.query.search,
          pages: "campgrounds",
        });
      }
    });
  } else {
    // Get all campgrounds from DB and render them
    // Campground.find().then((allCampgrounds) =>
    //   res.render("campgrounds/index", {
    //     campgrounds: allCampgrounds,
    //     page: "campgrounds",
    //   })
    // );
    var perPage = 6;
    var pageQuery = parseInt(req.query.page);
    var pageNumber = pageQuery ? pageQuery : 1;
    Campground.find({})
      .skip(perPage * pageNumber - perPage)
      .limit(perPage)
      .exec(function (err, allCampgrounds) {
        Campground.countDocuments().exec(function (err, count) {
          if (err) {
            console.log(err);
          } else {
            res.render("campgrounds/index", {
              campgrounds: allCampgrounds,
              current: pageNumber,
              pages: Math.ceil(count / perPage),
            });
          }
        });
      });
  }
});

// Create route - Add new campground to db
router.post("/", middleware.isLoggedIn, middleware.isPaid, (req, res) => {
  // Clear the text with malicious code
  req.body.description = req.sanitize(req.body.description);
  // get data from form and assign to 'newCampground'
  var name = req.body.name;
  var price = req.body.price;
  var image = req.body.image;
  var description = req.body.description;
  var author = {
    id: req.user._id,
    username: req.user.username,
  };
  var location = req.body.location;
  var lat = req.body.latitude;
  var lng = req.body.longitude;

  var newCampground = {
    name: name,
    price: price,
    image: image,
    description: description,
    author: author,
    location: location,
    lat: lat,
    lng: lng,
  };
  // Add the newCampground object to the DB and redirect back to campgrounds page
  Campground.create(newCampground).then(
    req.flash("success", "Successfully added a new campground!"),
    res.redirect("/campgrounds")
  );
});

// New route - Show form to create new campground
router.get("/new", middleware.isLoggedIn, middleware.isPaid, (req, res) => {
  // Route for adding new campgrounds
  res.render("campgrounds/new");
});

// Show - shows more info about one campground
router.get("/:slug", (req, res) => {
  Campground.findOne({ slug: req.params.slug })
    .populate("comments likes")
    .exec((err, foundCampground) => {
      err || !foundCampground
        ? (req.flash("error", "Campground not found"), res.redirect("back"))
        : res.render("campgrounds/show", {
            campground: foundCampground,
          });
    });
});

// Edit Campground Route
router.get("/:slug/edit", middleware.checkCampgroundOwnership, (req, res) => {
  Campground.findOne({ slug: req.params.slug }).then((foundCampground) =>
    res.render("campgrounds/edit", {
      campground: foundCampground,
    })
  );
});

// Update Campground Route
router.put("/:slug", middleware.checkCampgroundOwnership, (req, res) => {
  // Clear the text with malicious code --
  req.body.campground.description = req.sanitize(
    req.body.campground.description
  );
  // find and update the correct campground
  Campground.findOne({ slug: req.params.slug }, function (err, campground) {
    if (err) {
      res.redirect("/campgrounds");
    } else {
      campground.name = req.body.campground.name;
      campground.description = req.body.campground.description;
      campground.image = req.body.campground.image;
      campground.price = req.body.campground.price;
      campground.location = req.body.campground.location;
      campground.lat = req.body.campground.latitude;
      campground.lng = req.body.campground.longitude;
      campground.save(function (err) {
        if (err) {
          req.flash("error", "err.message");
          res.redirect("/campgrounds");
        } else {
          req.flash("success", "Campground successfully updated.");
          res.redirect("/campgrounds/" + campground.slug);
        }
      });
    }
  });
});

// Campground Like Route
router.post("/:slug/like", middleware.isLoggedIn, async function (req, res) {
  await Campground.findOne({ slug: req.params.slug }, function (
    err,
    foundCampground
  ) {
    if (err) {
      req.flash("error", "err.message");
      res.redirect("/campgrounds");
    }

    // check if req.user._id exists in foundCampground.likes
    var foundUserLike = foundCampground.likes.some(function (like) {
      return like.equals(req.user._id);
    });

    if (foundUserLike) {
      // user already liked, removing like
      foundCampground.likes.pull(req.user._id);
    } else {
      // adding the new user like
      foundCampground.likes.push(req.user);
    }

    foundCampground.save(function (err) {
      if (err) {
        req.flash("error", "err.message");
        return res.redirect("/campgrounds");
      }
      return res.redirect("/campgrounds/" + foundCampground.slug);
    });
  });
});

// Delete Campground Route
// router.delete('/:id', (req, res) => Campground.findByIdAndRemove(req.params.id).then(res.redirect('/campgrounds')));
// Remove campground as well as comments associated with it.
router.delete(
  "/:slug",
  middleware.checkCampgroundOwnership,
  async (req, res) => {
    try {
      await Campground.deleteOne({ slug: req.params.slug });
      req.flash("success", "Campground deleted!");
      res.redirect("/campgrounds");
    } catch (error) {
      console.log(error.message);
      res.redirect("/campgrounds");
    }
  }
);

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
