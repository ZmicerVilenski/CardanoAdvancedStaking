import { Head } from "$fresh/runtime.ts";
import { Handlers, PageProps } from "$fresh/server.ts";
 
import Oneshot from "../islands/Oneshot.tsx";
import { readValidators, Validators } from "../utils.ts";
 
interface Data {
  validators: Validators;
}
 
export const handler: Handlers<Data> = {
  GET(_req, ctx) {
    const validators = readValidators();
 
    return ctx.render({ validators });
  },
};
 
export default function Home({ data }: PageProps<Data>) {
  const { validators } = data;
 
  return (
    <>
      <Head>
        <title>Staking</title>
      </Head>
 
      <body style="background-color:powderblue;">


      <div class="max-w-2xl mx-auto mt-20 mb-10">
        <div class="mb-10">
          <h2 class="text-lg font-semibold text-gray-900">
            Minting and lock contract
          </h2>
 
          <h3 class="mt-4 mb-2">Redeem</h3>
          <pre class="bg-gray-200 p-2 rounded overflow-x-scroll">
            {validators.redeem.script}
          </pre>
 
          <h3 class="mt-4 mb-2">Staking_</h3>
          <pre class="bg-gray-200 p-2 rounded overflow-x-scroll">
            {validators.staking_.script}
          </pre>
        </div>
 
        <Oneshot validators={validators} />
      </div>

      </body>
      
    </>
  );
}