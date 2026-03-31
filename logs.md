# Searching Logs in Seq

Open the Seq UI at **http://localhost:5380** and type filters in the search bar.

## Common Searches

### By correlationId (trace a single request across all services)
```
correlationId = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
```

### By service
```
service = 'onboarding-api'
service = 'ingestion-service'
service = 'data-loader'
```

### By operation (database insert vs update)
```
operation = 'INSERTED'
operation = 'UPDATED'
has(operation)
```

### By log level
```
@Level = 'Warning'
@Level = 'Error'
@Level = 'Warning' or @Level = 'Error'
```

### By account number
```
accountNo = 'ACCT-2001'
```

### Combining filters
```
service = 'ingestion-service' and operation = 'UPDATED'
correlationId = 'abc123' and service = 'onboarding-api'
```
