import { Router } from "express";
import {
  addToAllowlist,
  removeFromAllowlist,
  getAllowlist,
} from "../stores/allowlistStore";

const router = Router();

router.get("/", (req, res) => {
  res.json(getAllowlist());
});

router.post("/:id", (req, res) => {
  addToAllowlist(req.params.id);

  res.json({
    message: `${req.params.id} added to allowlist`,
  });
});

router.delete("/:id", (req, res) => {
  removeFromAllowlist(req.params.id);

  res.json({
    message: `${req.params.id} removed from allowlist`,
  });
});

export default router;
