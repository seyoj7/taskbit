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
          <a href="https://explorer.testnet.arc.io" target="_blank" rel="noopener noreferrer" className={styles.link}>Arc Explorer ↗</a>
          <a href="/marketplace" className={styles.link}>Marketplace</a>
          <a href="/post-task" className={styles.link}>Post Task</a>
        </div>
      </div>
    </footer>
  );
}
