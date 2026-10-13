# Migration fixture

`v1-backup.json` is a constructed example of the original version-one export contract, not a backup of a person. It includes a running timer, custom clock options, private example strings, a local image and a local audio reference whose identifier collides with a newly introduced sound.

The PNG is the project's original one-pixel test fixture. The WAV is an original 10 ms, mono 8 kHz PCM test tone generated mathematically. Both are test data under the repository MIT licence. No remote resource is fetched.

The fixture stays in version one when the application schema changes, so upgrading a real IndexedDB database and importing an older export can be exercised without rebuilding the old format from current defaults.
