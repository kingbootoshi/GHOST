// Module declaration to provide TypeScript typings for the `libsodium-wrappers-sumo` package.
// We simply re-export everything from `libsodium-wrappers` typings so the same
// type information can be used without duplication.

declare module 'libsodium-wrappers-sumo' {
  import sodium from 'libsodium-wrappers';
  export * from 'libsodium-wrappers';
  export default sodium;
} 