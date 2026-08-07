'use client';

import { useState } from 'react';
import { intlLocale } from '@noorixfin/i18n';
import { useLocale } from '../../../lib/i18n/locale-provider';

interface CalculatorProps {
  translations: {
    title: string;
    subtitle: string;
    monthlyIncome: string;
    monthlyExpenses: string;
    savingsGoal: string;
    timeToReach: string;
    months: string;
    years: string;
    almostThere: string;
    deficit: string;
  };
}

export default function SavingsCalculator({ translations: t }: CalculatorProps) {
  const [income, setIncome] = useState(50000);
  const [expenses, setExpenses] = useState(35000);
  const [goal, setGoal] = useState(100000);

  // Bare `toLocaleString()` renders Western digits regardless of language, so a
  // Bangla page showed "50,000" beside Bangla copy. Illustrative round numbers,
  // so no minor-unit conversion — `@noorixfin/money` is for real ledger amounts
  // and would force a noisy ".00" onto every slider.
  const { locale } = useLocale();
  const nf = new Intl.NumberFormat(intlLocale[locale], { maximumFractionDigits: 0 });

  const savingsPerMonth = income - expenses;
  const isDeficit = savingsPerMonth <= 0;
  
  let monthsToGoal = 0;
  let years = 0;
  let months = 0;
  
  if (!isDeficit) {
    monthsToGoal = Math.ceil(goal / savingsPerMonth);
    years = Math.floor(monthsToGoal / 12);
    months = monthsToGoal % 12;
  }
  const almostThere = !isDeficit && monthsToGoal <= 1;

  const handleDrag = (setter: React.Dispatch<React.SetStateAction<number>>, e: React.ChangeEvent<HTMLInputElement>) => {
    setter(Number(e.target.value));
  };

  return (
    <div className="m-card m-card-3d" style={{ padding: '2rem', maxWidth: '600px', margin: '0 auto', background: 'rgba(15, 23, 42, 0.6)' }}>
      <h3 className="m-h3" style={{ textAlign: 'center', marginBottom: '0.5rem' }}>{t.title}</h3>
      <p style={{ textAlign: 'center', color: 'var(--m-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>{t.subtitle}</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label htmlFor="calc-income" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--m-text)' }}>{t.monthlyIncome}</label>
            <span style={{ fontSize: '0.875rem', color: 'var(--m-green)', fontWeight: 700 }}>৳ {nf.format(income)}</span>
          </div>
          <input id="calc-income" type="range" min="10000" max="200000" step="5000" value={income} onChange={(e) => handleDrag(setIncome, e)} style={{ width: '100%', accentColor: 'var(--m-green)' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label htmlFor="calc-expenses" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--m-text)' }}>{t.monthlyExpenses}</label>
            <span style={{ fontSize: '0.875rem', color: '#f87171', fontWeight: 700 }}>৳ {nf.format(expenses)}</span>
          </div>
          <input id="calc-expenses" type="range" min="5000" max="200000" step="5000" value={expenses} onChange={(e) => handleDrag(setExpenses, e)} style={{ width: '100%', accentColor: '#f87171' }} />
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <label htmlFor="calc-goal" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--m-text)' }}>{t.savingsGoal}</label>
            <span style={{ fontSize: '0.875rem', color: '#60a5fa', fontWeight: 700 }}>৳ {nf.format(goal)}</span>
          </div>
          <input id="calc-goal" type="range" min="10000" max="1000000" step="10000" value={goal} onChange={(e) => handleDrag(setGoal, e)} style={{ width: '100%', accentColor: '#60a5fa' }} />
        </div>
      </div>

      <div style={{ marginTop: '2.5rem', padding: '1.5rem', borderRadius: '12px', background: 'rgba(0, 0, 0, 0.2)', border: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
        <h4 style={{ fontSize: '0.875rem', color: 'var(--m-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {t.timeToReach}
        </h4>
        <div style={{ fontSize: '2rem', fontWeight: 800, color: isDeficit ? '#f87171' : '#fbbf24' }}>
          {isDeficit ? (
            <span style={{ fontSize: '1.2rem' }}>{t.deficit}</span>
          ) : almostThere ? (
            <span style={{ fontSize: '1.2rem', color: 'var(--m-green)' }}>{t.almostThere}</span>
          ) : (
            <>
              {years > 0 && <span>{nf.format(years)} <span style={{ fontSize: '1rem', color: 'var(--m-muted)', fontWeight: 600 }}>{t.years}</span> </span>}
              {months > 0 && <span>{nf.format(months)} <span style={{ fontSize: '1rem', color: 'var(--m-muted)', fontWeight: 600 }}>{t.months}</span></span>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
