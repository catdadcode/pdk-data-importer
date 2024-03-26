# File Based Imports

Your solution should be implemented using TypeScript. You may use any additional libraries you
like to implement your solution. Spend as much time on the exercise as you feel is appropriate;
while optimized solutions are nice a correct solution is most important.

Code submissions may be provided through a zip file, GitHub, Google Drive, or any similar service
which allows us to access and assess your code remotely.

## File Submission

Implement an HTTP(S) service which will accept a file to be imported. The file processing should
be handled by a separate service/process. The import process should be able to handle the
following types of errors:

-  Invalid entry
   -  First/Last name is missing, empty, or too long
   -  (when supplied) is a valid email address
   -  pin/duressPin is > maximum value
   -  bluetooth/mobile credential is > 0 and no email address is present
-  Conflicts
   -  If multiple entries in the file map to the same person the entries must be identical
      -  When an id for the person is not present in the file uniqueness is determined by:
         -  email address (if present) otherwise first and last name
         -  if an existing record exists in the DB for the name based match it is considered a conflict
   -  Multiple occurrences of the same custom attribute
-  Invalid file format
-  Missing header line
-  Too many entries (maximum records per file is limited to 10,000)

NOTE: It should be possible to import the same file successfully multiple times if a unique
`personId` or `email` is present for all entries.

## File Processing Status

The user should be provided feedback regarding:

-  File has been accepted for processing
-  File has begun processing
-  File has finished processing
-  Import report

## Import Report

The import report should include the following details:

-  Any errors encountered including line/record where the error was encountered and nature of the error
-  If no errors were detected
   -  Number of records created
   -  Number of records updated
   -  Number of credential invites which will be sent
      -  determined by the quantity of bluetooth/mobile credentials added

## Object Schema

The following represents the data as it would be stored in a relational database.

```ts
interface Person {
	personId: string;
	first: string; // min length: 1, max length: 50
	last: string; // min length: 1, max length: 50
	enabled: boolean; // defaults to true
	activeDate?: Date;
	expireDate?: Date;
	email?: string; // max length: 255
	pin?: number; // max: 9999999999
	pinDuress?: number; // max: 9999999999
	/**
	 * custom attributes for the person, not able to be
	 * specified independently in the import file.
	 * Any custom attributes to be imported will be prefixed
	 * with `custom.` in the header.
	 */
	metadata: any;
}

interface Credential {
	credentialId: string;
	personId: string;
	type: CredentialType;
	value?: string;
}

interface Group {
	groupId: string;
	name: string;
}

interface GroupMembership {
	personId: string;
	groupId: string;
}

const CredentialType = <const>["bluetooth", "card", "mobile"];
type CredentialType = (typeof CredentialType)[number];
```

## Sample Data

It is possible for multiple card credentials to be provided in the import file.
The separator for multiple card based credentials will be a comma. Custom attributes
may be included in the file. Each custom attribute may only be specified once in the
header row. The value of `bluetooth` and `mobile` fields is a count of the number of
credentials of that type which should exist for the person record after processing the
import file. A value of `0` should result in any credentials of the specified type being
removed from the record. A positive value should only be used to add additional credentials
of that type up to the quantity specified, it should not remove any credentials nor should
the count not matching result in a conflict.

## Bonus Points

-  Data is persisted to a PostgreSQL database
-  Support for XLSX and CSV file formats
-  Support for import from Google Sheets URL
-  Ability to upload multiple files concurrently and process them sequentially
-  Support importing data for separate customers concurrently
   -  independent notifications of the file processing and results
-  Advanced email validation
   -  Reject disposable domains
   -  Reject addresses with invalid domains
      -  No DNS record
      -  No MX record
   -  Invalid recipient detection
