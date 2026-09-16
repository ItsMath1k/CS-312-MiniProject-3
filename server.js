const express = require("express");

const app = express();
const PORT = 3000;

app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

let posts = [];

app.get("/", (req, res) => {
    res.render("index", { posts: posts });
});

app.post("/posts", (req, res) => {
    const newPost = {
        id: Date.now(),
        name: req.body.name,
        title: req.body.title,
        content: req.body.content,
        time: new Date().toLocaleString()
    };

    posts.push(newPost);

    res.redirect("/");
});

app.get("/posts/:id/edit", (req, res) => {
    const post = posts.find(post => post.id == req.params.id);

    res.render("edit", { post: post });
});

app.post("/posts/:id/edit", (req, res) => {
    const post = posts.find(post => post.id == req.params.id);

    post.name = req.body.name;
    post.title = req.body.title;
    post.content = req.body.content;

    res.redirect("/");
});

app.post("/posts/:id/delete", (req, res) => {
    posts = posts.filter(post => post.id != req.params.id);

    res.redirect("/");
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});