
import "./Footer.css";

/* =========================================================
   FOOTER

   The same footer the rest of the application already used,
   pulled into one component so every page stays in step.
========================================================= */

export default function Footer() {
  return (
    <footer className="el-footer">
      <div className="el-footer-logo">ElectroLink</div>

      <div className="el-footer-links">
        <a href="#terms">Terms of Service</a>
        <a href="#privacy">Privacy Policy</a>
        <a href="#support">Technical Support</a>
        <a href="#certifications">Certifications</a>
      </div>

      <div className="el-footer-copy">
        © {new Date().getFullYear()} ElectroLink Industrial. All rights
        reserved.
      </div>
    </footer>
  );
}
