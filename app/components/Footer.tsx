import Image from 'next/image';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.brand}>
          <Image src="/taskbit_logo.png" alt="Taskbit" width={24} height={24} className={styles.logo} />
          <span className={styles.brandName}>Taskbit</span>
          <span>© 2026. All rights reserved.</span>
        </div>
        
        <div className={styles.links}>
          <a href="#" className={styles.link}>Twitter</a>
          <a href="#" className={styles.link}>Discord</a>
          <a href="#" className={styles.link}>GitHub</a>
        </div>
      </div>
    </footer>
  );
}
