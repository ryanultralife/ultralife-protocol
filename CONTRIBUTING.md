# Contributing to UltraLife Protocol

Thank you for your interest in contributing to UltraLife Protocol.

## Ways to Contribute

### Code
- Smart contract improvements
- Test coverage
- Deployment tooling
- Documentation

### Domain Expertise
- Registry categories for your field
- Impact measurement methodologies
- Bioregional knowledge

### Community
- Testing on preview/preprod
- Documentation improvements
- Translation

## Development Setup

1. Install [Aiken](https://aiken-lang.org/)
2. Clone the repository
3. Build contracts: `cd contracts && aiken build`
4. Run checks: `aiken check`

## Pull Request Process

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure `aiken check` passes
5. Submit PR with clear description

## Code Style

- Follow existing patterns in codebase
- Document public functions
- Keep validators focused and minimal
- Use shared types from `lib/ultralife/types.ak`

## Registry Contributions

To propose new registry categories:
1. Identify parent category
2. Document specifications (standards, definitions)
3. Submit PR with spec hash pointing to IPFS documentation

## Questions?

Open an issue for discussion.

## License

By contributing, you agree that your contributions will be licensed under Apache 2.0.
