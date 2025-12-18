import React from 'react';
import { useNavigate } from 'react-router-dom';
import './App.css';

export function LandingPage() {
    const navigate = useNavigate();

    return (
        <div className="landing-container">
            <nav className="landing-nav">
                <div className="logo">Stacks Payroll</div>
                <button className="btn secondary" onClick={() => navigate('/dashboard')}>
                    Launch App
                </button>
            </nav>

            <header className="hero-section">
                <h1 className="hero-title">
                    Next-Gen <span className="neon-text">Payroll</span> on Stacks
                </h1>
                <p className="hero-subtitle">
                    Manage invoices, payments, and chainhooks with the power of Bitcoin L2.
                    Secure, transparent, and automated.
                </p>
                <div className="hero-buttons">
                    <button className="btn primary large" onClick={() => navigate('/dashboard')}>
                        Get Started
                    </button>
                    <button className="btn secondary large" onClick={() => window.open('https://stacks.co', '_blank')}>
                        Learn More
                    </button>
                </div>
            </header>

            <section className="features-grid">
                <div className="feature-card">
                    <div className="feature-icon">💸</div>
                    <h3>Smart Invoices</h3>
                    <p>Create and manage invoices directly on the Stacks blockchain with complete transparency.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🔗</div>
                    <h3>Chainhooks</h3>
                    <p>Real-time event monitoring and automated triggers for your smart contract interactions.</p>
                </div>
                <div className="feature-card">
                    <div className="feature-icon">🔒</div>
                    <h3>Secure Wallet</h3>
                    <p>Seamless integration with Leather, Xverse, and other leading Stacks wallets.</p>
                </div>
            </section>

            <footer className="landing-footer">
                <p>© 2024 Stacks Payroll. Built on Stacks.</p>
            </footer>
        </div>
    );
}
