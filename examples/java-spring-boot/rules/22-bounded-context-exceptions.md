---
description: Exception handling rules per bounded context
globs: "**/*.java"
alwaysApply: true
---

# Exception Handling per Bounded Context

## Principle

Each bounded context must define and use its **own specific exceptions**, consistent with its domain language. Do not use generic exceptions to represent business errors.

## Mandatory Rule

- Do not use `RuntimeException`, `Exception`, `Throwable`, or `Error` for domain or application errors.
- Do not use shared generic exceptions when the error belongs to a specific bounded context.
- Each bounded context must have its own package for exceptions.
- Exceptions of a bounded context must not be reused by other bounded contexts.

## Recommended Structure

```text
<bounded-context>/
  domain/
    exception/
      <BoundedContext>DomainException.java
      ResourceNotFoundInContextException.java
      InvalidStateTransitionException.java
  application/
    exception/
      <BoundedContext>ApplicationException.java
      UseCaseNotAllowedException.java
```

Alternatively, if the project uses a different structure, still keep exceptions close to the bounded context that owns them.

## Base Exception per BC

Each bounded context can define an abstract or concrete base exception:

```java
public abstract class OrderDomainException extends RuntimeException {

    protected OrderDomainException(String message) {
        super(message);
    }

    protected OrderDomainException(String message, Throwable cause) {
        super(message, cause);
    }
}
```

Specific exceptions extend the base exception of their context:

```java
public final class OrderCannotBeCancelledException extends OrderDomainException {

    public OrderCannotBeCancelledException(String orderId) {
        super("Order '%s' cannot be cancelled.".formatted(orderId));
    }
}
```

## Naming

- Use specific, readable names.
- The name must explain the business problem.
- Avoid vague names like `GenericException`, `BusinessException`, `ValidationException`, `ServiceException` unless they are abstract base exceptions of the context.

Good examples:

```text
SearchAlreadyCompletedException
InvalidSearchDateRangeException
ProviderUnavailableException
HotelContentNotFoundException
PaymentAlreadyCapturedException
CustomerCannotBeDeletedException
```

Examples to avoid:

```text
RuntimeException
Exception
GenericException
BusinessException
BadRequestException in the domain
ServiceException
```

## Separation from HTTP and Framework

- Domain exceptions must not depend on HTTP, Spring MVC, or status codes.
- Do not throw `ResponseStatusException`, `BadRequestException`, or equivalent framework-specific ones in the domain.
- Translation from exception to HTTP response must happen in the presentation layer through `@RestControllerAdvice` or equivalent handler.

## Centralized HTTP Mapping

Each bounded context can have a dedicated exception handler in the presentation layer:

```java
@RestControllerAdvice
public class OrderExceptionHandler {

    @ExceptionHandler(OrderCannotBeCancelledException.class)
    ResponseEntity<ProblemDetail> handle(OrderCannotBeCancelledException exception) {
        ProblemDetail problem = ProblemDetail.forStatus(HttpStatus.CONFLICT);
        problem.setTitle("Order cannot be cancelled");
        problem.setDetail(exception.getMessage());
        return ResponseEntity.status(HttpStatus.CONFLICT).body(problem);
    }
}
```

## Cross-Context Rules

- Do not import exceptions of one bounded context into another bounded context.
- If one context consumes another context through a port/API, translate the error at the boundary.
- Adapters can convert external errors into application exceptions of the current bounded context.
- Shared exceptions must be limited to truly cross-cutting and technical errors, not to domain concepts.

## Technical Errors

For infrastructure errors, use adapter-specific or application-context-specific exceptions:

```text
ExternalProviderTimeoutException
MessagePublishingFailedException
PersistenceOperationFailedException
ConfigurationMissingException
```

Do not turn every technical error into a generic `RuntimeException`.

## Anti-Patterns

| Anti-pattern | Alternative |
|---|---|
| `throw new RuntimeException("not found")` | `throw new CustomerNotFoundException(customerId)` |
| `throw new Exception(...)` | Bounded-context-specific exception |
| Domain exception with `HttpStatus` | HTTP mapping in `@RestControllerAdvice` |
| Reusing `OrderNotFoundException` in the `Invoice` context | Define `InvoiceOrderReferenceNotFoundException` or translate at the boundary |
| `catch (Exception e)` and generic rethrow | Catch specific types and rethrow a contextual exception |

## Checklist

1. Does the error belong to a specific bounded context?
2. Does a specific exception already exist in the same bounded context?
3. Does the exception name clearly describe the problem?
4. Does the exception avoid HTTP/framework dependencies?
5. Is the exception mapped to HTTP only in the presentation layer?
6. Is no other bounded context improperly reusing this exception?