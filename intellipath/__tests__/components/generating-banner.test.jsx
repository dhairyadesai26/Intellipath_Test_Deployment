import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { GeneratingBanner } from '@/components/ui/generating-banner';
import { useRouter } from 'next/navigation';

// Mock the Next.js router so our tests don't throw an error when running outside a browser
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}));

// Mock ESM icon libraries that sometimes fail to transpile in JSDOM
jest.mock('lucide-react', () => ({
  Loader2: () => <div data-testid="loader-icon">Loader</div>,
  RefreshCw: () => <div data-testid="refresh-icon">Refresh</div>,
}));

describe('GeneratingBanner Component', () => {
  it('renders the passed message and handles the refresh button click', () => {
    // Setup the mock router behavior for this specific test
    const mockRefresh = jest.fn();
    useRouter.mockReturnValue({ refresh: mockRefresh });

    // Render the component virtually
    render(<GeneratingBanner message="Testing AI Generation..." />);

    // 1. Assert specific DOM text exists
    expect(screen.getByText('Generating your personalised data…')).toBeInTheDocument();
    expect(screen.getByText('Testing AI Generation...')).toBeInTheDocument();

    // 2. Simulate User Action: Clicking the refresh button
    const refreshButton = screen.getByRole('button', { name: /Refresh now/i });
    fireEvent.click(refreshButton);

    // 3. Assert the Next.js router.refresh() function was triggered
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
