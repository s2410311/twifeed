import { route, dispatch } from "./router.js";
import { renderHome }    from "./pages/home.js";
import { renderSign }    from "./pages/sign.js";
import { renderArticle } from "./pages/article.js";
import { renderUser }    from "./pages/user.js";
import { renderProfile } from "./pages/profile.js";
import { renderTag }     from "./pages/tag.js";

route("/",              renderHome);
route("/sign",          renderSign);
route("/article/:aid",  ({ aid })  => renderArticle(parseInt(aid)));
route("/user/:uid",     ({ uid })  => renderUser(uid));
route("/profile",       renderProfile);
route("/tag/:name",     ({ name }) => renderTag(name));

dispatch(location.pathname);
