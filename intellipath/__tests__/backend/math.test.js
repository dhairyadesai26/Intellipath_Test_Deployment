describe('Backend Setup Sanity Check', () => {
  it('should successfully execute generic javascript functions', () => {
    const sum = (a, b) => a + b;
    expect(sum(1, 2)).toBe(3);
    expect(typeof sum).toBe('function');
  });
});
