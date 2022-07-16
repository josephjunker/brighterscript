import { expectCompletionsIncludes, expectZeroDiagnostics, getTestGetTypedef, getTestTranspile } from '../../../testHelpers.spec';
import util, { standardizePath as s } from '../../../util';
import { Program } from '../../../Program';
import { createSandbox } from 'sinon';
import { Parser } from '../../Parser';
import { expect } from 'chai';
import type { ConstStatement } from '../../Statement';
import { TokenKind } from '../../../lexer/TokenKind';
import { LiteralExpression } from '../../Expression';
import { CompletionItemKind } from 'vscode-languageserver-protocol';

const sinon = createSandbox();

describe('ConstStatement', () => {
    let rootDir = s`${process.cwd()}/.tmp/rootDir`;
    let program: Program;
    let parser: Parser;
    let testTranspile = getTestTranspile(() => [program, rootDir]);
    let testGetTypedef = getTestGetTypedef(() => [program, rootDir]);

    beforeEach(() => {
        program = new Program({ rootDir: rootDir, sourceMap: true });
        parser = new Parser();
    });
    afterEach(() => {
        sinon.restore();
        program.dispose();
    });

    it('supports basic structure', () => {
        parser.parse('const API_KEY = "abc"');
        expectZeroDiagnostics(parser);
        const statement = parser.ast.statements[0] as ConstStatement;
        expect(statement.tokens.const?.kind).to.eql(TokenKind.Const);
        expect(statement.tokens.name).to.include({
            kind: TokenKind.Identifier,
            text: 'API_KEY'
        });
        const value = statement.value as LiteralExpression;
        expect(value).to.be.instanceof(LiteralExpression);
        expect(value.token?.text).to.eql('"abc"');
        //ensure range is correct
        expect(statement.range).to.eql(util.createRange(0, 0, 0, 21));
    });

    it('produces typedef', () => {
        testGetTypedef(`
            const API_KEY = "abc"
            const SOME_OBJ = {}
            const SOME_ARR = []
        `);
    });

    describe('transpile', () => {

        it('transpiles simple consts', () => {
            testTranspile(`
                const API_KEY = "abc"
                sub main()
                    print API_KEY
                end sub
            `, `
                sub main()
                    print "abc"
                end sub
            `);
        });

        it('transpiles arrays', () => {
            testTranspile(`
                const WORDS = [
                    "alpha"
                    "beta"
                ]
                sub main()
                    print WORDS
                end sub
            `, `
                sub main()
                    print ([
                        "alpha"
                        "beta"
                    ])
                end sub
            `);
        });

        it('transpiles objects', () => {
            testTranspile(`
                const DEFAULTS = {
                    alpha: true
                    beta: true
                }
                sub main()
                    print DEFAULTS
                end sub
            `, `
                sub main()
                    print ({
                        alpha: true
                        beta: true
                    })
                end sub
            `);
        });

        it('supports consts inside namespaces', () => {
            testTranspile(`
                namespace network
                    const API_KEY = "abc"
                    sub get()
                        print API_KEY
                    end sub
                end namespace
                sub main()
                    print network.API_KEY
                end sub
            `, `
                sub network_get()
                    print "abc"
                end sub

                sub main()
                    print "abc"
                end sub
            `);
        });

        it('supports property access on complex objects', () => {
            testTranspile(`
                const DEFAULTS = {
                    enabled: true
                }
                sub main()
                    print DEFAULTS.enabled
                end sub
            `, `
                sub main()
                    print ({
                        enabled: true
                    }).enabled
                end sub
            `);
        });

        it('supports calling methods on consts', () => {
            testTranspile(`
                const API_KEY ="ABC"
                sub main()
                    print API_KEY.toString()
                end sub
            `, `
                sub main()
                    print "ABC".toString()
                end sub
            `);
        });
    });

    describe('completions', () => {
        it('shows up in standard completions', () => {
            program.setFile('source/main.bs', `
                const API_KEY = "123"
                sub log(message)
                    log()
                end sub
            `);

            expectCompletionsIncludes(
                // log(|)
                program.getCompletions('source/main.bs', util.createPosition(3, 24)),
                [{
                    label: 'API_KEY',
                    kind: CompletionItemKind.Constant
                }]
            );
        });

        it('shows up in namespace completions', () => {
            program.setFile('source/main.bs', `
                namespace constants
                    const API_KEY = "123"
                end namespace
                sub log(message)
                    log(constants.)
                end sub
            `);

            expectCompletionsIncludes(
                // log(|)
                program.getCompletions('source/main.bs', util.createPosition(5, 34)),
                [{
                    label: 'API_KEY',
                    kind: CompletionItemKind.Constant
                }]
            );
        });
    });
});