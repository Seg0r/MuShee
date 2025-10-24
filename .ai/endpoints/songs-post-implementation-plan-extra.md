### Phase 3: Security Hardening

9. **Implement XXE Protection**
   - Configure XML parser with secure settings
   - Add pre-parse validation to reject files with DOCTYPE declarations
   - Add unit tests with XXE attack payloads
   - Document security measures in code comments

10. **Add Rate Limiting**
    - Implement per-user upload rate limiting in Angular service
    - Consider using Supabase Edge Functions or frontend throttling
    - Configure appropriate limits (e.g., 10 uploads per minute)
    - Handle rate limit errors appropriately

11. **Configure Storage Security**
    - Set up Supabase Storage bucket with proper policies
    - Configure CORS for frontend uploads
    - Ensure RLS policies are applied to storage
    - Test access control with different user scenarios

### Phase 4: Error Handling & Logging

14. **Add Monitoring Hooks**
    - Track upload success/failure rates
    - Track duplicate detection rate
    - Track parsing errors by type
    - Monitor storage usage growth

### Phase 5: Testing

15. **Unit Tests**
    - Test MusicXML parser with various file formats
    - Test hash calculation consistency
    - Test validation functions with edge cases
    - Test error class instantiation and DTO conversion
    - Target: 80%+ code coverage

16. **Integration Tests**
    - Test full upload flow with valid files
    - Test duplicate detection and handling
    - Test error scenarios (invalid files, large files, etc.)
    - Test authentication and authorization
    - Test storage operations

17. **Security Tests**
    - Test XXE attack prevention
    - Test file size limit enforcement
    - Test authentication bypass attempts
    - Test SQL injection via metadata fields
    - Consider using automated security scanning tools

18. **Performance Tests**
    - Load test with multiple concurrent uploads
    - Test with maximum file size (10MB)
    - Test with complex MusicXML files
    - Measure and optimize bottlenecks
    - Validate performance targets are met

### Phase 6: Documentation & Deployment

19. **Service Documentation**
    - Document service methods and interfaces
    - Add usage examples with Angular code
    - Document error codes and scenarios
    - Add frontend integration examples

20. **Code Documentation**
    - Add JSDoc comments to all services and methods
    - Document security considerations inline
    - Add README for service architecture and Supabase SDK usage
    - Document environment variables and configuration

21. **Deployment Preparation**
    - Configure environment variables for production
    - Set up Supabase Storage bucket in production
    - Configure rate limiting in production
    - Set up monitoring and alerting
    - Create deployment checklist

22. **Post-Deployment Validation**
    - Test upload functionality in production
    - Verify authentication works correctly
    - Check storage bucket permissions
    - Monitor error logs for issues
    - Validate performance metrics

### Future Enhancements

- **Asynchronous Processing**: Consider using a job queue for large file processing
- **Metadata Validation**: Add more sophisticated MusicXML validation (key signature, time signature, etc.)
- **Thumbnail Generation**: Generate preview images of sheet music during upload
- **Batch Upload**: Support multiple file uploads in a single request
- **Storage Optimization**: Compress MusicXML files before storage
- **Caching Layer**: Add Redis caching for frequently accessed songs
