import { Route, Routes } from "react-router";

import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Docs } from "./routes/Docs";
import { Home } from "./routes/Home";
import { Launch } from "./routes/Launch";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Projects } from "./routes/Projects";

export function App() {
  return (
    <div className="shell">
      <Header />
      <main id="main">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </main>
      <Footer />
    </div>
  );
}
