import { createApp } from "./app";
import { migrate, seed } from "./db";

const PORT = Number(process.env.PORT ?? 5179);

migrate();
seed();

const app = createApp();

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
