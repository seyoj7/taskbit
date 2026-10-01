import datetime
from database import SessionLocal, User, Task, init_db

def seed_data():
    init_db()
    db = SessionLocal()
    
    # Create some dummy users (posters)
    wallets = [
        "0x" + "1" * 40,
        "0x" + "2" * 40
    ]
    
    for w in wallets:
        if not db.query(User).filter_by(wallet_address=w).first():
            db.add(User(wallet_address=w))
    db.commit()
    
    u1 = db.query(User).filter_by(wallet_address=wallets[0]).first()
    u2 = db.query(User).filter_by(wallet_address=wallets[1]).first()
    
    # 5 different tasks for the marketplace
    tasks = [
        Task(
            title="Fix responsive layout on dashboard",
            description="The dashboard looks broken on mobile devices, specifically iPhone 12/13 screens. Need someone to fix the flexbox layout in `dashboard.module.css`.",
            bounty_usdc=25.50,
            status="posted",
            poster_id=u1.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=7)
        ),
        Task(
            title="Write unit tests for the Escrow contract",
            description="We need 100% test coverage for the `releasePayment` and `refundTask` functions in `TaskEscrow.sol`. Please use Hardhat and Chai.",
            bounty_usdc=100.00,
            status="posted",
            poster_id=u2.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=14)
        ),
        Task(
            title="Implement Dark Mode toggle",
            description="Add a simple React context for dark mode and a toggle button in the Navbar. Update the global CSS variables accordingly.",
            bounty_usdc=40.00,
            status="posted",
            poster_id=u1.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=5)
        ),
        Task(
            title="Create a modern Logo for Taskbit",
            description="We need an SVG logo. Needs to be minimalist, using colors that represent crypto/web3 and gig economy. Deliver the raw SVG.",
            bounty_usdc=75.00,
            status="posted",
            poster_id=u2.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=30)
        ),
        Task(
            title="Integrate WalletConnect v2",
            description="Currently we only support direct injected providers (like MetaMask). Please add Web3Modal / WalletConnect v2 support so users can connect from mobile.",
            bounty_usdc=150.00,
            status="posted",
            poster_id=u1.id,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(days=10)
        )
    ]
    
    db.add_all(tasks)
    db.commit()
    print("Successfully seeded 5 tasks into the marketplace!")
    db.close()

if __name__ == "__main__":
    seed_data()
