// Metro resolves media assets to numeric module ids at bundle time.
declare module '*.wav' {
  const asset: number;
  export default asset;
}
